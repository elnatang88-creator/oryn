import 'server-only'
import { z } from 'zod'
import { getDb } from '../db'
import { newId } from '../ids'
import { invalid, notFound } from '../errors'
import { audit } from '../audit'
import { track } from '../analytics'
import { orgPlan, requireCapability } from '../plans'
import { requireOrgPermission } from '../permissions'

export interface EventRules { allowPhone: boolean; allowedKinds: string[] | null; note: string }
export interface OrynEvent {
  id: string; org_id: string; name: string; venue: string; starts_on: string | null; ends_on: string | null
  rules: EventRules; status: 'draft' | 'live' | 'ended'; created_at: Date
}

const eventInput = z.object({
  name: z.string().trim().min(2, 'Name the event.').max(80),
  venue: z.string().trim().max(120).default(''),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  allowPhone: z.boolean().default(false),
  note: z.string().trim().max(200).default(''),
})

export async function createEvent(userId: string, orgId: string, input: z.input<typeof eventInput>) {
  const r = eventInput.safeParse(input)
  if (!r.success) throw invalid(r.error.issues[0].message)
  const db = await getDb()
  await requireOrgPermission(db, userId, orgId, 'events.manage')
  await requireCapability(db, await orgPlan(db, orgId), 'events', userId)
  if (r.data.startsOn && r.data.endsOn && r.data.endsOn < r.data.startsOn) throw invalid('The end date is before the start date.')
  const id = newId('evt')
  const rules: EventRules = { allowPhone: r.data.allowPhone, allowedKinds: null, note: r.data.note }
  await db.query(`INSERT INTO events (id, org_id, name, venue, starts_on, ends_on, rules, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`, [
    id, orgId, r.data.name, r.data.venue, r.data.startsOn, r.data.endsOn, JSON.stringify(rules), userId,
  ])
  await audit(db, { actor: userId, action: 'event.created', targetType: 'event', targetId: id, orgId })
  await track(db, 'event_created', { userId, orgId })
  return id
}

/** Events the user can see: those of their workspaces, plus events they participate in. */
export async function listEvents(userId: string) {
  const db = await getDb()
  return db.query<OrynEvent & { org_name: string; participants: number; my_role: string | null }>(
    `SELECT e.*, o.name AS org_name, (SELECT count(*)::int FROM event_participants p WHERE p.event_id = e.id AND p.status <> 'removed') AS participants,
            (SELECT m.role FROM memberships m WHERE m.org_id = e.org_id AND m.user_id = $1) AS my_role
       FROM events e JOIN organizations o ON o.id = e.org_id
      WHERE EXISTS (SELECT 1 FROM memberships m WHERE m.org_id = e.org_id AND m.user_id = $1)
         OR EXISTS (SELECT 1 FROM event_participants p WHERE p.event_id = e.id AND p.user_id = $1 AND p.status <> 'removed')
      ORDER BY e.starts_on DESC NULLS LAST, e.created_at DESC`,
    [userId],
  )
}

export async function getEvent(userId: string, eventId: string) {
  const db = await getDb()
  const [e] = await db.query<OrynEvent>(`SELECT * FROM events WHERE id = $1`, [eventId])
  if (!e) throw notFound('That event')
  await requireOrgPermission(db, userId, e.org_id, 'events.view')
  const [stats] = await db.query<{ shares: number; opened: number; requests: number; connections: number }>(
    `SELECT (SELECT count(*)::int FROM share_sessions WHERE event_id = $1) AS shares,
            (SELECT coalesce(sum(view_count),0)::int FROM share_sessions WHERE event_id = $1) AS opened,
            (SELECT count(*)::int FROM connection_requests r JOIN share_sessions s ON s.id = r.share_session_id WHERE s.event_id = $1) AS requests,
            (SELECT count(*)::int FROM connections WHERE event_id = $1) AS connections`,
    [eventId],
  )
  return { event: e, stats }
}

export async function setEventStatus(userId: string, eventId: string, status: 'draft' | 'live' | 'ended') {
  const db = await getDb()
  const [e] = await db.query<{ org_id: string }>(`SELECT org_id FROM events WHERE id = $1`, [eventId])
  if (!e) throw notFound('That event')
  await requireOrgPermission(db, userId, e.org_id, 'events.manage')
  await db.query(`UPDATE events SET status = $2 WHERE id = $1`, [eventId, status])
  await audit(db, { actor: userId, action: 'event.status_changed', targetType: 'event', targetId: eventId, orgId: e.org_id, meta: { status } })
}

export async function updateEventRules(userId: string, eventId: string, rules: Partial<EventRules>) {
  const db = await getDb()
  const [e] = await db.query<{ org_id: string; rules: EventRules }>(`SELECT org_id, rules FROM events WHERE id = $1`, [eventId])
  if (!e) throw notFound('That event')
  await requireOrgPermission(db, userId, e.org_id, 'events.manage')
  const next = { ...e.rules, ...rules }
  await db.query(`UPDATE events SET rules = $2::jsonb WHERE id = $1`, [eventId, JSON.stringify(next)])
  await audit(db, { actor: userId, action: 'event.rules_changed', targetType: 'event', targetId: eventId, orgId: e.org_id, meta: next as unknown as Record<string, unknown> })
}

const participantInput = z.object({
  email: z.string().trim().toLowerCase().email('Enter an email.'),
  displayName: z.string().trim().min(1, 'Add a name.').max(80),
  role: z.enum(['attendee', 'exhibitor', 'speaker', 'staff']).default('attendee'),
})

export async function listParticipants(userId: string, eventId: string) {
  const db = await getDb()
  const [e] = await db.query<{ org_id: string }>(`SELECT org_id FROM events WHERE id = $1`, [eventId])
  if (!e) throw notFound('That event')
  await requireOrgPermission(db, userId, e.org_id, 'events.view')
  return db.query<{ id: string; email: string; display_name: string; role: string; status: string; has_account: boolean }>(
    `SELECT id, email, display_name, role, status, (user_id IS NOT NULL) AS has_account FROM event_participants WHERE event_id = $1 AND status <> 'removed' ORDER BY role, display_name`,
    [eventId],
  )
}

export async function addParticipant(userId: string, eventId: string, input: z.input<typeof participantInput>) {
  const r = participantInput.safeParse(input)
  if (!r.success) throw invalid(r.error.issues[0].message)
  const db = await getDb()
  const [e] = await db.query<{ org_id: string }>(`SELECT org_id FROM events WHERE id = $1`, [eventId])
  if (!e) throw notFound('That event')
  await requireOrgPermission(db, userId, e.org_id, 'participants.manage')
  const [u] = await db.query<{ id: string }>(`SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`, [r.data.email])
  await db.query(
    `INSERT INTO event_participants (id, event_id, org_id, user_id, email, display_name, role, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (event_id, email) DO UPDATE SET status = EXCLUDED.status, role = EXCLUDED.role, display_name = EXCLUDED.display_name`,
    [newId('par'), eventId, e.org_id, u?.id ?? null, r.data.email, r.data.displayName, r.data.role, u ? 'active' : 'invited'],
  )
  await audit(db, { actor: userId, action: 'event.participant_added', targetType: 'event', targetId: eventId, orgId: e.org_id, meta: { role: r.data.role } })
  await track(db, 'participant_added', { userId, orgId: e.org_id })
}

export async function removeParticipant(userId: string, eventId: string, participantId: string) {
  const db = await getDb()
  const [p] = await db.query<{ org_id: string; user_id: string | null }>(`SELECT org_id, user_id FROM event_participants WHERE id = $1 AND event_id = $2`, [participantId, eventId])
  if (!p) throw notFound('That participant')
  await requireOrgPermission(db, userId, p.org_id, 'participants.manage')
  await db.tx(async (t) => {
    await t.query(`UPDATE event_participants SET status = 'removed' WHERE id = $1`, [participantId])
    if (p.user_id) await t.query(`UPDATE share_sessions SET revoked_at = now() WHERE event_id = $1 AND owner_user_id = $2 AND revoked_at IS NULL`, [eventId, p.user_id])
    await audit(t, { actor: userId, action: 'event.participant_removed', targetType: 'event', targetId: eventId, orgId: p.org_id })
  })
}
