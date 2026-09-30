import 'server-only'
import { getDb, type Db } from '../db'
import { newId } from '../ids'
import { audit } from '../audit'
import { track } from '../analytics'
import { invalid, notFound } from '../errors'
import { enqueue } from '../jobs'
import { rateLimit } from '../ratelimit'

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

export async function requestDeletion(userId: string, confirmEmail: string) {
  const db = await getDb()
  const [u] = await db.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [userId])
  if (!u || u.email !== confirmEmail.trim().toLowerCase()) throw invalid('Type your account email to confirm.')
  const [existing] = await db.query(`SELECT 1 FROM deletion_requests WHERE user_id = $1 AND status = 'scheduled'`, [userId])
  if (existing) return
  const when = new Date(Date.now() + DELETION_GRACE_DAYS * 86400_000)
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

export async function cancelDeletion(userId: string) {
  const db = await getDb()
  const r = await db.query(`UPDATE deletion_requests SET status = 'canceled' WHERE user_id = $1 AND status = 'scheduled' RETURNING id`, [userId])
  if (r.length) await audit(db, { actor: userId, action: 'account.deletion_canceled', targetType: 'user', targetId: userId })
}

/** Hard delete. Cascades remove capsules, shares, connections, notes and follow-ups. Audit rows are kept but de-identified. */
export async function executeDeletion(db: Db, requestId: string, userId: string) {
  const [req] = await db.query<{ status: string }>(`SELECT status FROM deletion_requests WHERE id = $1`, [requestId])
  if (!req || req.status !== 'scheduled') return
  await db.tx(async (t) => {
    const owned = await t.query<{ org_id: string }>(`SELECT org_id FROM memberships WHERE user_id = $1 AND role = 'owner'`, [userId])
    for (const o of owned) {
      const [other] = await t.query<{ user_id: string }>(`SELECT user_id FROM memberships WHERE org_id = $1 AND user_id <> $2 ORDER BY (role = 'admin') DESC, created_at LIMIT 1`, [o.org_id, userId])
      if (other) await t.query(`UPDATE memberships SET role = 'owner' WHERE org_id = $1 AND user_id = $2`, [o.org_id, other.user_id])
    }
    await t.query(`UPDATE organizations SET created_by = (SELECT user_id FROM memberships WHERE org_id = organizations.id AND role = 'owner' AND user_id <> $1 LIMIT 1) WHERE created_by = $1 AND EXISTS (SELECT 1 FROM memberships WHERE org_id = organizations.id AND user_id <> $1)`, [userId])
    await t.query(`DELETE FROM organizations WHERE created_by = $1`, [userId])
    await t.query(`UPDATE events SET created_by = (SELECT user_id FROM memberships WHERE org_id = events.org_id AND role = 'owner' LIMIT 1) WHERE created_by = $1`, [userId])
    await t.query(`UPDATE audit_events SET actor_user_id = NULL, meta = meta || '{"deidentified":true}'::jsonb WHERE actor_user_id = $1`, [userId])
    await t.query(`UPDATE analytics_events SET user_id = NULL WHERE user_id = $1`, [userId])
    // The deletion request row cascades away with the user; the de-identified audit event is the lasting record.
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
