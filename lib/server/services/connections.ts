import 'server-only'
import { z } from 'zod'
import { getDb } from '../db'
import { newId } from '../ids'
import { AppError, invalid, notFound } from '../errors'
import { audit } from '../audit'
import { track } from '../analytics'
import { requireCapability, userPlan } from '../plans'
import { project, resolveShare, startShare } from './sharing'
import type { Db } from '../db'
import type { Capsule } from './capsules'

export interface Connection {
  id: string
  owner_user_id: string
  name: string
  headline: string
  contact: { kind: string; label: string; value: string }[]
  source: 'request_accepted' | 'kept_capsule' | 'manual' | 'nearby'
  share_session_id: string | null
  event_id: string | null
  met_where: string
  met_at: Date
  status: 'active' | 'archived'
  created_at: Date
}

export interface ConnectionRequest {
  id: string
  share_session_id: string
  from_name: string
  from_contact: string
  message: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: Date
  capsule_name: string
  context_label: string
  event_name: string | null
}

export async function listRequests(userId: string, status: 'pending' | 'all' = 'pending') {
  const db = await getDb()
  return db.query<ConnectionRequest>(
    `SELECT r.id, r.share_session_id, r.from_name, r.from_contact, r.message, r.status, r.created_at, c.name AS capsule_name, s.context_label, e.name AS event_name
       FROM connection_requests r JOIN share_sessions s ON s.id = r.share_session_id JOIN capsules c ON c.id = s.capsule_id
       LEFT JOIN events e ON e.id = s.event_id
      WHERE r.owner_user_id = $1 ${status === 'pending' ? `AND r.status = 'pending'` : ''} ORDER BY r.created_at DESC LIMIT 100`,
    [userId],
  )
}

export async function respondToRequest(userId: string, requestId: string, accept: boolean) {
  const db = await getDb()
  const [kind] = await db.query<{ kind: string }>(`SELECT kind FROM connection_requests WHERE id = $1 AND owner_user_id = $2`, [requestId, userId])
  if (kind?.kind === 'member') return respondToMemberRequest(db, userId, requestId, accept)
  const [r] = await db.query<ConnectionRequest & { org_id: string | null; event_id: string | null }>(
    `SELECT r.*, s.context_label, s.org_id, s.event_id, e.name AS event_name FROM connection_requests r JOIN share_sessions s ON s.id = r.share_session_id LEFT JOIN events e ON e.id = s.event_id
      WHERE r.id = $1 AND r.owner_user_id = $2`,
    [requestId, userId],
  )
  if (!r) throw notFound('That request')
  if (r.status !== 'pending') return { connectionId: null }
  let connectionId: string | null = null
  await db.tx(async (t) => {
    await t.query(`UPDATE connection_requests SET status = $2, responded_at = now() WHERE id = $1`, [requestId, accept ? 'accepted' : 'declined'])
    if (accept) {
      connectionId = newId('con')
      const kind = /@/.test(r.from_contact) ? 'email' : /^[+()\d\s.-]{5,}$/.test(r.from_contact) ? 'phone' : 'text'
      await t.query(
        `INSERT INTO connections (id, owner_user_id, org_id, name, contact, source, share_session_id, event_id, met_where, met_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,'request_accepted',$6,$7,$8,$9)`,
        [connectionId, userId, r.org_id, r.from_name, JSON.stringify([{ kind, label: 'Shared with you', value: r.from_contact }]), r.share_session_id, r.event_id, r.event_name ?? r.context_label ?? '', r.created_at],
      )
      if (r.message) await t.query(`INSERT INTO private_notes (id, connection_id, owner_user_id, body) VALUES ($1,$2,$3,$4)`, [newId('note'), connectionId, userId, `Their message: “${r.message}”`])
    }
    await audit(t, { actor: userId, action: accept ? 'connection_request.accepted' : 'connection_request.declined', targetType: 'connection_request', targetId: requestId })
  })
  // Declining is silent: the requester is never told.
  await track(db, accept ? 'connect_accepted' : 'connect_declined', { userId })
  return { connectionId }
}

/** Recipient chose "Keep in ORYN": a private copy of what they were shown, in THEIR workspace. The sender only sees an anonymous "saved" count. */
export async function keepCapsule(userId: string, token: string, claimToken: string | null) {
  const res = await resolveShare(token, { layer: 'expanded', claimToken })
  if (res.status !== 'ok') throw new AppError('not_found', 'This capsule is no longer available.')
  if (!res.view.canSave) throw new AppError('forbidden', 'This capsule can be viewed but not saved.')
  if (res.session.owner_user_id === userId) throw invalid('This is your own capsule.')
  const db = await getDb()
  const [existing] = await db.query<{ id: string }>(`SELECT id FROM connections WHERE owner_user_id = $1 AND share_session_id = $2`, [userId, res.session.id])
  if (existing) return existing.id
  const id = newId('con')
  const v = res.view
  await db.query(
    `INSERT INTO connections (id, owner_user_id, contact_user_id, name, headline, contact, source, share_session_id, event_id, met_where)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,'kept_capsule',$7,$8,$9)`,
    [id, userId, res.session.owner_user_id, v.displayName, v.headline, JSON.stringify(v.fields.map(({ kind, label, value }) => ({ kind, label, value }))), res.session.id, res.session.event_id, v.eventName ?? ''],
  )
  await db.query(`UPDATE share_sessions SET saved_count = saved_count + 1 WHERE id = $1`, [res.session.id])
  await db.query(`INSERT INTO interactions (id, share_session_id, owner_user_id, kind) VALUES ($1,$2,$3,'kept')`, [newId('int'), res.session.id, res.session.owner_user_id])
  await audit(db, { actor: userId, action: 'connection.kept', targetType: 'connection', targetId: id })
  await track(db, 'app_offer_accepted', { userId, props: { via: 'keep' } })
  return id
}

export async function listConnections(userId: string, q = '') {
  const db = await getDb()
  const plan = await userPlan(db, userId)
  return db.query<Connection & { open_followups: number; next_due: string | null }>(
    `SELECT c.*, (SELECT count(*)::int FROM follow_ups f WHERE f.connection_id = c.id AND f.done_at IS NULL) AS open_followups,
            (SELECT min(due_on)::text FROM follow_ups f WHERE f.connection_id = c.id AND f.done_at IS NULL) AS next_due
       FROM connections c
      WHERE c.owner_user_id = $1 AND c.status = 'active' AND c.met_at > now() - make_interval(days => $3)
        AND ($2 = '' OR c.name ILIKE '%' || $2 || '%' OR c.met_where ILIKE '%' || $2 || '%' OR c.headline ILIKE '%' || $2 || '%')
      ORDER BY c.met_at DESC LIMIT 200`,
    [userId, q.slice(0, 60), plan.limits.historyDays],
  )
}

export async function getConnection(userId: string, connectionId: string) {
  const db = await getDb()
  const [c] = await db.query<Connection & { event_name: string | null }>(
    `SELECT c.*, e.name AS event_name FROM connections c LEFT JOIN events e ON e.id = c.event_id WHERE c.id = $1 AND c.owner_user_id = $2`, [connectionId, userId],
  )
  if (!c) throw notFound('That connection')
  const notes = await db.query<{ id: string; body: string; created_at: Date }>(`SELECT id, body, created_at FROM private_notes WHERE connection_id = $1 AND owner_user_id = $2 ORDER BY created_at DESC`, [connectionId, userId])
  const followUps = await db.query<{ id: string; title: string; due_on: string; done_at: Date | null }>(`SELECT id, title, due_on, done_at FROM follow_ups WHERE connection_id = $1 AND owner_user_id = $2 ORDER BY done_at NULLS FIRST, due_on`, [connectionId, userId])
  return { connection: c, notes, followUps }
}

export async function addNote(userId: string, connectionId: string, body: string) {
  const text = body.trim()
  if (!text) throw invalid('Write something first.')
  if (text.length > 4000) throw invalid('Keep notes under 4,000 characters.')
  const db = await getDb()
  await requireCapability(db, await userPlan(db, userId), 'notes.private', userId)
  const [c] = await db.query(`SELECT 1 FROM connections WHERE id = $1 AND owner_user_id = $2`, [connectionId, userId])
  if (!c) throw notFound('That connection')
  const noteId = newId('note')
  await db.query(`INSERT INTO private_notes (id, connection_id, owner_user_id, body) VALUES ($1,$2,$3,$4)`, [noteId, connectionId, userId, text])
  // The note text is never written to logs.
  await audit(db, { actor: userId, action: 'note.added', targetType: 'private_note', targetId: noteId })
  await track(db, 'note_added', { userId })
}

export async function deleteNote(userId: string, noteId: string) {
  const db = await getDb()
  const r = await db.query(`DELETE FROM private_notes WHERE id = $1 AND owner_user_id = $2 RETURNING id`, [noteId, userId])
  if (r.length) await audit(db, { actor: userId, action: 'note.deleted', targetType: 'private_note', targetId: noteId })
}

const followUpInput = z.object({
  title: z.string().trim().min(1, 'Say what you want to do.').max(120),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.'),
})

export async function addFollowUp(userId: string, connectionId: string, input: z.input<typeof followUpInput>) {
  const r = followUpInput.safeParse(input)
  if (!r.success) throw invalid(r.error.issues[0].message)
  const db = await getDb()
  await requireCapability(db, await userPlan(db, userId), 'followups', userId)
  const [c] = await db.query(`SELECT 1 FROM connections WHERE id = $1 AND owner_user_id = $2`, [connectionId, userId])
  if (!c) throw notFound('That connection')
  const id = newId('fu')
  await db.query(`INSERT INTO follow_ups (id, connection_id, owner_user_id, title, due_on) VALUES ($1,$2,$3,$4,$5)`, [id, connectionId, userId, r.data.title, r.data.dueOn])
  await audit(db, { actor: userId, action: 'followup.created', targetType: 'follow_up', targetId: id })
  await track(db, 'followup_created', { userId })
  return id
}

export async function setFollowUpDone(userId: string, followUpId: string, done: boolean) {
  const db = await getDb()
  const r = await db.query(`UPDATE follow_ups SET done_at = ${done ? 'now()' : 'NULL'} WHERE id = $1 AND owner_user_id = $2 RETURNING id`, [followUpId, userId])
  if (!r.length) throw notFound('That follow-up')
  await audit(db, { actor: userId, action: done ? 'followup.completed' : 'followup.reopened', targetType: 'follow_up', targetId: followUpId })
  if (done) await track(db, 'followup_completed', { userId })
}

export async function listFollowUps(userId: string) {
  const db = await getDb()
  return db.query<{ id: string; title: string; due_on: string; done_at: Date | null; connection_id: string; name: string }>(
    `SELECT f.id, f.title, f.due_on, f.done_at, f.connection_id, c.name FROM follow_ups f JOIN connections c ON c.id = f.connection_id
      WHERE f.owner_user_id = $1 AND (f.done_at IS NULL OR f.done_at > now() - interval '7 days') ORDER BY f.done_at NULLS FIRST, f.due_on LIMIT 200`,
    [userId],
  )
}

export async function archiveConnection(userId: string, connectionId: string) {
  const db = await getDb()
  const r = await db.query(`UPDATE connections SET status = 'archived' WHERE id = $1 AND owner_user_id = $2 RETURNING id`, [connectionId, userId])
  if (!r.length) throw notFound('That connection')
  await audit(db, { actor: userId, action: 'connection.archived', targetType: 'connection', targetId: connectionId })
}

export async function updateConnectionContext(userId: string, connectionId: string, metWhere: string) {
  const db = await getDb()
  const r = await db.query(`UPDATE connections SET met_where = $3 WHERE id = $1 AND owner_user_id = $2 RETURNING id`, [connectionId, userId, metWhere.trim().slice(0, 120)])
  if (!r.length) throw notFound('That connection')
  await audit(db, { actor: userId, action: 'connection.context_updated', targetType: 'connection', targetId: connectionId })
}

/** Snapshot of what a member's share permits: the same projection a recipient of their link would get. Null once stopped. */
export async function memberSnapshot(db: Db, shareSessionId: string) {
  const [row] = await db.query<{ capsule: Capsule; allow_expanded: boolean; interaction_level: 'view' | 'save' | 'connect'; expires_at: Date | null; one_time: boolean; context_label: string }>(
    `SELECT to_jsonb(c.*) AS capsule, s.allow_expanded, s.interaction_level, s.expires_at, s.one_time, s.context_label FROM share_sessions s JOIN capsules c ON c.id = s.capsule_id AND c.status = 'active' WHERE s.id = $1 AND s.revoked_at IS NULL`, [shareSessionId])
  if (!row) return null
  const v = project(row.capsule, row, 'expanded')
  return { name: v.displayName, headline: v.headline, contact: v.fields.map(({ kind, label, value }) => ({ kind, label, value })) }
}


/**
 * ORYN-to-ORYN: B accepts A. Each side receives what the OTHER side's card permits (the same projection a link
 * recipient would get — never hidden details or private notes), and both land in People. "Not now" stays silent.
 */
async function respondToMemberRequest(db: Db, userId: string, requestId: string, accept: boolean) {
  const [r] = await db.query<{ id: string; status: string; from_user_id: string; share_session_id: string; event_id: string | null; event_name: string | null; context_label: string }>(
    `SELECT r.id, r.status, r.from_user_id, r.share_session_id, s.event_id, e.name AS event_name, s.context_label
       FROM connection_requests r JOIN share_sessions s ON s.id = r.share_session_id LEFT JOIN events e ON e.id = s.event_id
      WHERE r.id = $1 AND r.owner_user_id = $2 AND r.kind = 'member'`, [requestId, userId])
  if (!r) throw notFound('That request')
  if (r.status !== 'pending') {
    const [c] = await db.query<{ id: string }>(`SELECT id FROM connections WHERE owner_user_id = $1 AND contact_user_id = $2 AND status = 'active'`, [userId, r.from_user_id])
    return { connectionId: c?.id ?? null }
  }
  if (!accept) {
    await db.query(`UPDATE connection_requests SET status = 'declined', responded_at = now() WHERE id = $1`, [requestId])
    await audit(db, { actor: userId, action: 'connection_request.declined', targetType: 'connection_request', targetId: requestId })
    await track(db, 'connect_declined', { userId })
    return { connectionId: null }
  }
  const theirCard = await memberSnapshot(db, r.share_session_id)
  if (!theirCard) throw new AppError('not_found', 'This request is no longer available.')
  // What I give back: a share of my own default card, with my own disclosure rules.
  const mine = await startShare(userId, { channel: 'nearby', contextLabel: r.context_label || 'Nearby', durationMinutes: null, oneTime: false })
  const myCard = await memberSnapshot(db, mine.id)
  const where = r.event_name ?? 'Nearby'
  let connectionId: string | null = null
  await db.tx(async (t) => {
    const won = await t.query(`UPDATE connection_requests SET status = 'accepted', responded_at = now() WHERE id = $1 AND status = 'pending' RETURNING id`, [requestId])
    if (!won.length) return
    const upsert = async (owner: string, contactUser: string, card: NonNullable<typeof theirCard>, shareId: string) => {
      const [had] = await t.query<{ id: string }>(`SELECT id FROM connections WHERE owner_user_id = $1 AND contact_user_id = $2 AND status = 'active'`, [owner, contactUser])
      if (had) {
        await t.query(`UPDATE connections SET name = $2, headline = $3, contact = $4::jsonb, met_at = now() WHERE id = $1`, [had.id, card.name, card.headline, JSON.stringify(card.contact)])
        return had.id
      }
      const id = newId('con')
      await t.query(
        `INSERT INTO connections (id, owner_user_id, contact_user_id, name, headline, contact, source, share_session_id, event_id, met_where)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,'nearby',$7,$8,$9)`,
        [id, owner, contactUser, card.name, card.headline, JSON.stringify(card.contact), shareId, r.event_id, where],
      )
      return id
    }
    connectionId = await upsert(userId, r.from_user_id, theirCard, r.share_session_id)
    const theirConnection = await upsert(r.from_user_id, userId, myCard!, mine.id)
    await t.query(`INSERT INTO notifications (id, user_id, kind, body, link) VALUES ($1,$2,'connect_accepted',$3,$4)`,
      [newId('ntf'), r.from_user_id, `${myCard!.name} accepted — you’re connected.`, `/connections/${theirConnection}`])
    await audit(t, { actor: userId, action: 'connection_request.accepted', targetType: 'connection_request', targetId: requestId, meta: { via: 'nearby' } })
  })
  await track(db, 'connect_accepted', { userId, props: { via: 'nearby' } })
  return { connectionId }
}
