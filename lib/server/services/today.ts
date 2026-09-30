import 'server-only'
import { getDb } from '../db'
import { listShares } from './sharing'

/** Everything the Today screen needs, answering: who did I meet, what did I share, what's next. */
export async function todaySummary(userId: string) {
  const db = await getDb()
  const [newConnections, pending, due, activity, shares, [counts], notifications] = await Promise.all([
    db.query<{ id: string; name: string; headline: string; met_where: string; met_at: Date; source: string }>(
      `SELECT id, name, headline, met_where, met_at, source FROM connections WHERE owner_user_id = $1 AND status = 'active' AND met_at > now() - interval '7 days' ORDER BY met_at DESC LIMIT 6`, [userId]),
    db.query<{ id: string; from_name: string; message: string; created_at: Date; context_label: string }>(
      `SELECT r.id, r.from_name, r.message, r.created_at, CASE WHEN r.kind = 'member' THEN 'ORYN member · ' || coalesce(nullif(s.context_label, ''), 'Nearby') ELSE s.context_label END AS context_label FROM connection_requests r JOIN share_sessions s ON s.id = r.share_session_id
        WHERE r.owner_user_id = $1 AND r.status = 'pending' ORDER BY r.created_at DESC LIMIT 10`, [userId]),
    db.query<{ id: string; title: string; due_on: string; connection_id: string; name: string; overdue: boolean }>(
      `SELECT f.id, f.title, f.due_on, f.connection_id, c.name, (f.due_on < current_date) AS overdue FROM follow_ups f JOIN connections c ON c.id = f.connection_id
        WHERE f.owner_user_id = $1 AND f.done_at IS NULL AND f.due_on <= current_date + 2 ORDER BY f.due_on LIMIT 10`, [userId]),
    db.query<{ kind: string; created_at: Date; capsule_name: string; context_label: string }>(
      `SELECT i.kind, i.created_at, c.name AS capsule_name, s.context_label FROM interactions i JOIN share_sessions s ON s.id = i.share_session_id JOIN capsules c ON c.id = s.capsule_id
        WHERE i.owner_user_id = $1 AND i.kind IN ('opened','expanded','saved_vcard','kept','connect_requested','blocked_revoked') ORDER BY i.created_at DESC LIMIT 12`, [userId]),
    listShares(userId, { activeOnly: true, limit: 5 }),
    db.query<{ opened: number; expanded: number; saved: number }>(
      `SELECT coalesce(sum(view_count),0)::int AS opened, coalesce(sum(expanded_count),0)::int AS expanded, coalesce(sum(saved_count),0)::int AS saved
         FROM share_sessions WHERE owner_user_id = $1 AND created_at > now() - interval '7 days'`, [userId]),
    db.query<{ id: string; body: string; link: string | null; created_at: Date }>(
      `SELECT id, body, link, created_at FROM notifications WHERE user_id = $1 AND read_at IS NULL ORDER BY created_at DESC LIMIT 5`, [userId]),
  ])
  return { newConnections, pending, due, activity, shares, counts, notifications }
}

export async function markNotificationsRead(userId: string) {
  const db = await getDb()
  await db.query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [userId])
}

const CHANNEL_LABEL: Record<string, string> = { nearby: 'Nearby', qr: 'Your card link', link: 'Your card link', web_share: 'Your card link', shortcut: 'Your card link', wallet_pass: 'Wallet pass', station: 'Stations', kept: 'Their card', manual: 'Added by you' }

/**
 * Relationship intelligence for Today, from first-party records only. Insights with too little data are left out
 * rather than guessed: a "top" card or channel needs at least 2 connections behind it.
 */
export async function relationshipSummary(userId: string) {
  const db = await getDb()
  const [[week], byCard, byChannel, quiet] = await Promise.all([
    db.query<{ opens: number; connections: number; saves: number; followups: number }>(
      `SELECT (SELECT count(*)::int FROM interactions WHERE owner_user_id = $1 AND kind = 'opened' AND created_at > now() - interval '7 days') AS opens,
              (SELECT count(*)::int FROM connections WHERE owner_user_id = $1 AND status = 'active' AND created_at > now() - interval '7 days') AS connections,
              (SELECT count(*)::int FROM interactions WHERE owner_user_id = $1 AND kind IN ('saved_vcard','kept') AND created_at > now() - interval '7 days') AS saves,
              (SELECT count(*)::int FROM follow_ups WHERE owner_user_id = $1 AND done_at IS NULL) AS followups`, [userId]),
    db.query<{ id: string; name: string; n: number }>(
      `SELECT k.id, k.name, count(*)::int AS n FROM connections c JOIN capsules k ON k.id = c.my_capsule_id
        WHERE c.owner_user_id = $1 AND c.status = 'active' AND c.created_at > now() - interval '30 days' GROUP BY k.id, k.name HAVING count(*) >= 2 ORDER BY n DESC LIMIT 3`, [userId]),
    db.query<{ channel: string; n: number }>(
      `SELECT channel, count(*)::int AS n FROM connections WHERE owner_user_id = $1 AND status = 'active' AND channel IS NOT NULL AND created_at > now() - interval '30 days'
        GROUP BY channel HAVING count(*) >= 2 ORDER BY n DESC LIMIT 1`, [userId]),
    // Met recently, no note and no reminder yet: the people most likely to be forgotten.
    db.query<{ id: string; name: string; place: string | null; met_at: Date }>(
      `SELECT c.id, c.name, coalesce(e.name, nullif(c.met_where, '')) AS place, c.met_at FROM connections c LEFT JOIN events e ON e.id = c.event_id
        WHERE c.owner_user_id = $1 AND c.status = 'active' AND c.met_at > now() - interval '14 days'
          AND NOT EXISTS (SELECT 1 FROM private_notes n WHERE n.connection_id = c.id) AND NOT EXISTS (SELECT 1 FROM follow_ups f WHERE f.connection_id = c.id)
        ORDER BY c.met_at DESC LIMIT 3`, [userId]),
  ])
  return { week, topCards: byCard, topChannel: byChannel[0] ? { label: CHANNEL_LABEL[byChannel[0].channel] ?? byChannel[0].channel, n: byChannel[0].n } : null, quiet }
}

/** "Who did I meet at that event?" — my own connections tagged to the event, never anyone else's. */
export async function myEventRelationships(userId: string, eventId: string) {
  const db = await getDb()
  const [s] = await db.query<{ people: number; followups: number; noted: number }>(
    `SELECT count(*)::int AS people,
            (SELECT count(*)::int FROM follow_ups f JOIN connections c2 ON c2.id = f.connection_id WHERE c2.owner_user_id = $1 AND c2.event_id = $2 AND f.done_at IS NULL) AS followups,
            count(*) FILTER (WHERE EXISTS (SELECT 1 FROM private_notes n WHERE n.connection_id = c.id))::int AS noted
       FROM connections c WHERE c.owner_user_id = $1 AND c.event_id = $2 AND c.status = 'active'`, [userId, eventId])
  return s
}
