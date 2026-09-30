import 'server-only'
import { getDb, type Db } from '../db'
import { newId } from '../ids'
import { audit } from '../audit'
import { track } from '../analytics'
import { invalid, notFound } from '../errors'
import { enqueue } from '../jobs'
import { rateLimit } from '../ratelimit'
import { verifyPassword } from './auth'
import { hmac } from '../secrets'

export const DELETION_GRACE_DAYS = 7

export async function privacyOverview(userId: string) {
  const db = await getDb()
  const [counts] = await db.query<{ capsules: number; live_shares: number; connections: number; notes: number; interactions: number }>(
    `SELECT (SELECT count(*)::int FROM capsules WHERE owner_user_id = $1 AND status='active') AS capsules,
            (SELECT count(*)::int FROM share_sessions WHERE owner_user_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())) AS live_shares,
            (SELECT count(*)::int FROM connections WHERE owner_user_id = $1) AS connections,
            (SELECT count(*)::int FROM private_notes WHERE owner_user_id = $1) AS notes,
            (SELECT count(*)::int FROM interactions WHERE owner_user_id = $1) AS interactions`, [userId])
  const exports = await db.query<{ id: string; status: string; requested_at: Date; ready_at: Date | null; expires_at: Date | null }>(
    `SELECT id, status, requested_at, ready_at, expires_at FROM data_exports WHERE user_id = $1 ORDER BY requested_at DESC LIMIT 3`, [userId])
  const [deletion] = await db.query<{ id: string; scheduled_for: Date }>(`SELECT id, scheduled_for FROM deletion_requests WHERE user_id = $1 AND status = 'scheduled'`, [userId])
  const [u] = await db.query<{ retention_days: number | null }>(`SELECT retention_days FROM users WHERE id = $1`, [userId])
  return { counts, exports, deletion: deletion ?? null, retentionDays: u?.retention_days ?? null }
}

export async function requestExport(userId: string) {
  const db = await getDb()
  await rateLimit(db, `export:${userId}`, 5, 86400)
  const id = newId('exp')
  await db.query(`INSERT INTO data_exports (id, user_id) VALUES ($1,$2)`, [id, userId])
  await enqueue(db, 'export.build', { exportId: id, userId })
  await audit(db, { actor: userId, action: 'data.export_requested', targetType: 'data_export', targetId: id })
  await track(db, 'export_requested', { userId })
  return id
}

/** Builds the export. Includes everything ORYN holds about the person's own account and content. */
export async function buildExport(db: Db, exportId: string, userId: string) {
  const q = (sql: string) => db.query(sql, [userId])
  const payload = {
    format: 'oryn-export-v1',
    generatedAt: new Date().toISOString(),
    account: (await q(`SELECT id, email, display_name, plan_key, retention_days, created_at FROM users WHERE id = $1`))[0],
    capsules: await q(`SELECT c.*, to_jsonb(p.*) AS policy FROM capsules c LEFT JOIN visibility_policies p ON p.capsule_id = c.id WHERE c.owner_user_id = $1`),
    shareSessions: await q(`SELECT id, capsule_id, channel, scope, context_label, one_time, interaction_level, view_count, expanded_count, saved_count, expires_at, revoked_at, created_at FROM share_sessions WHERE owner_user_id = $1`),
    interactions: await q(`SELECT share_session_id, kind, created_at FROM interactions WHERE owner_user_id = $1`),
    connectionRequests: await q(`SELECT id, from_name, from_contact, message, status, created_at, responded_at FROM connection_requests WHERE owner_user_id = $1`),
    connections: await q(`SELECT * FROM connections WHERE owner_user_id = $1`),
    privateNotes: await q(`SELECT connection_id, body, created_at FROM private_notes WHERE owner_user_id = $1`),
    followUps: await q(`SELECT connection_id, title, due_on, done_at, created_at FROM follow_ups WHERE owner_user_id = $1`),
    memberships: await q(`SELECT org_id, role, created_at FROM memberships WHERE user_id = $1`),
    devices: await q(`SELECT label, first_seen_at, last_seen_at FROM devices WHERE user_id = $1`),
    securityLog: await q(`SELECT action, target_type, created_at FROM audit_events WHERE actor_user_id = $1 ORDER BY created_at DESC LIMIT 1000`),
  }
  await db.query(`UPDATE data_exports SET status = 'ready', payload = $2::jsonb, ready_at = now(), expires_at = now() + interval '7 days' WHERE id = $1`, [exportId, JSON.stringify(payload)])
}

export async function downloadExport(userId: string, exportId: string) {
  const db = await getDb()
  const [e] = await db.query<{ payload: unknown; status: string; expires_at: Date | null }>(`SELECT payload, status, expires_at FROM data_exports WHERE id = $1 AND user_id = $2`, [exportId, userId])
  if (!e || e.status !== 'ready' || (e.expires_at && new Date(e.expires_at) < new Date())) throw notFound('That export')
  await audit(db, { actor: userId, action: 'data.export_downloaded', targetType: 'data_export', targetId: exportId })
  return e.payload
}

/**
 * Step 1 of account deletion. Requires re-authentication with the current password (knowing the
 * email is not enough). Every share closes immediately; erasure runs when the grace period ends.
 */
export async function requestDeletion(userId: string, password: string) {
  if (typeof password !== 'string' || !password) throw invalid('Enter your password to confirm.')
  const db = await getDb()
  await rateLimit(db, `delete-reauth:${userId}`, 5, 900)
  const [u] = await db.query<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL`, [userId])
  if (!u || !(await verifyPassword(password, u.password_hash))) {
    await audit(db, { actor: userId, action: 'account.deletion_reauth_failed', targetType: 'user', targetId: userId })
    throw invalid('That password isn’t right.')
  }
  const [existing] = await db.query(`SELECT 1 FROM deletion_requests WHERE user_id = $1 AND status = 'scheduled'`, [userId])
  if (existing) return
  const when = new Date(Date.now() + graceDays() * 86400_000)
  const id = newId('del')
  await db.tx(async (t) => {
    await t.query(`INSERT INTO deletion_requests (id, user_id, scheduled_for) VALUES ($1,$2,$3)`, [id, userId, when])
    // Everything stops being visible immediately; data is erased when the grace period ends.
    await t.query(`UPDATE share_sessions SET revoked_at = now() WHERE owner_user_id = $1 AND revoked_at IS NULL`, [userId])
    await enqueue(t, 'deletion.execute', { requestId: id, userId }, when)
    await audit(t, { actor: userId, action: 'account.deletion_scheduled', targetType: 'user', targetId: userId, meta: { scheduledFor: when } })
  })
  await track(db, 'deletion_requested', { userId })
}

function graceDays() {
  const v = Number(process.env.ORYN_DELETION_GRACE_DAYS ?? DELETION_GRACE_DAYS)
  return Number.isFinite(v) && v >= 0 ? v : DELETION_GRACE_DAYS
}

export async function cancelDeletion(userId: string) {
  const db = await getDb()
  const r = await db.query(`UPDATE deletion_requests SET status = 'canceled' WHERE user_id = $1 AND status = 'scheduled' RETURNING id`, [userId])
  if (r.length) await audit(db, { actor: userId, action: 'account.deletion_canceled', targetType: 'user', targetId: userId })
}

/**
 * Step 2: erase. Everything the person owns is deleted or de-identified; nothing owned by another
 * user or another tenant is deleted. Safety rules:
 *  - the request must belong to this user, be scheduled and be due (a mismatched job does nothing);
 *  - organizations are never deleted by a blind cascade: shared ones are handed to another member,
 *    and a solo organization is deleted only after other users' records inside it are detached.
 */
export async function executeDeletion(db: Db, requestId: string, userId: string) {
  await db.tx(async (t) => {
    const [req] = await t.query<{ id: string }>(
      `SELECT id FROM deletion_requests WHERE id = $1 AND user_id = $2 AND status = 'scheduled' AND scheduled_for <= now() FOR UPDATE`,
      [requestId, userId],
    )
    if (!req) return
    const [u] = await t.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [userId])
    if (!u) return

    // Organizations this person owns.
    const owned = await t.query<{ org_id: string }>(`SELECT org_id FROM memberships WHERE user_id = $1 AND role = 'owner'`, [userId])
    for (const { org_id } of owned) {
      const [heir] = await t.query<{ user_id: string }>(
        `SELECT user_id FROM memberships WHERE org_id = $1 AND user_id <> $2 ORDER BY (role = 'admin') DESC, (role = 'manager') DESC, created_at LIMIT 1`, [org_id, userId])
      if (heir) {
        await t.query(`UPDATE memberships SET role = 'owner' WHERE org_id = $1 AND user_id = $2`, [org_id, heir.user_id])
        await t.query(`UPDATE organizations SET created_by = $2 WHERE id = $1`, [org_id, heir.user_id])
        await audit(t, { actor: null, action: 'org.ownership_transferred', targetType: 'organization', targetId: org_id, orgId: org_id, meta: { reason: 'owner_account_deleted' } })
      } else {
        // Solo organization: other users' shares at its events belong to them — close and detach, never delete.
        await t.query(`UPDATE share_sessions SET revoked_at = coalesce(revoked_at, now()), org_id = NULL, event_id = NULL WHERE org_id = $1 AND owner_user_id <> $2`, [org_id, userId])
        await t.query(`DELETE FROM organizations WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM memberships WHERE org_id = $1 AND user_id <> $2)`, [org_id, userId])
      }
    }
    // Records in organizations that stay: point authorship at the current owner instead of the person.
    await t.query(`UPDATE organizations o SET created_by = m.user_id FROM memberships m WHERE o.created_by = $1 AND m.org_id = o.id AND m.role = 'owner' AND m.user_id <> $1`, [userId])
    await t.query(`UPDATE events e SET created_by = m.user_id FROM memberships m WHERE e.created_by = $1 AND m.org_id = e.org_id AND m.role = 'owner' AND m.user_id <> $1`, [userId])
    // Their entries in other organizations' participant lists: de-identify.
    await t.query(`UPDATE event_participants SET user_id = NULL, email = 'deleted-' || id || '@deleted.invalid', display_name = 'Deleted account', status = 'removed' WHERE user_id = $1 OR email = $2`, [userId, u.email])

    // Logs keep their integrity but lose the identity.
    await t.query(`UPDATE audit_events SET actor_user_id = NULL, meta = (meta - 'device') || '{"deidentified":true}'::jsonb WHERE actor_user_id = $1`, [userId])
    await t.query(`UPDATE audit_events SET target_id = NULL WHERE target_type = 'user' AND target_id = $1`, [userId])
    await t.query(`UPDATE audit_events SET meta = meta - 'owner' WHERE meta->>'owner' = $1`, [userId])
    await t.query(`UPDATE analytics_events SET user_id = NULL WHERE user_id = $1`, [userId])
    await t.query(`DELETE FROM rate_limits WHERE key = ANY($1)`, [[`signin-fail:${hmac(`email:${u.email}`).slice(0, 24)}`, `delete-reauth:${userId}`, `share:${userId}`, `export:${userId}`, `pwchange:${userId}`]])
    await t.query(`DELETE FROM jobs WHERE payload->>'userId' = $1`, [userId])
    await t.query(`DELETE FROM subscriptions WHERE subject_type = 'user' AND subject_id = $1`, [userId])

    // The user row: cascades to capsules, visibility policies, their share sessions and QR destinations,
    // interactions, connection requests to them, connections, private notes, follow-ups, notifications,
    // devices, sessions, exports, memberships and this deletion request.
    await t.query(`DELETE FROM users WHERE id = $1`, [userId])
    await audit(t, { actor: null, action: 'account.deleted', targetType: 'user', targetId: null, meta: { requestId } })
  })
}

export async function setRetention(userId: string, days: number | null) {
  if (days !== null && (!Number.isInteger(days) || days < 7 || days > 3650)) throw invalid('Choose between 7 days and 10 years.')
  const db = await getDb()
  await db.query(`UPDATE users SET retention_days = $2 WHERE id = $1`, [userId, days])
  await audit(db, { actor: userId, action: 'privacy.retention_changed', targetType: 'user', targetId: userId, meta: { days } })
  await track(db, 'privacy_control_used', { userId, props: { control: 'retention' } })
  await enqueue(db, 'retention.prune', { userId })
}

/** Removes interaction history older than the person's retention window (anonymous counts on shares remain). */
export async function pruneRetention(db: Db, userId: string) {
  const [u] = await db.query<{ retention_days: number | null }>(`SELECT retention_days FROM users WHERE id = $1`, [userId])
  if (!u?.retention_days) return 0
  const r = await db.query(`DELETE FROM interactions WHERE owner_user_id = $1 AND created_at < now() - make_interval(days => $2) RETURNING id`, [userId, u.retention_days])
  return r.length
}
