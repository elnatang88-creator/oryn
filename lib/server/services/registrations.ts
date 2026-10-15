import 'server-only'
import { z } from 'zod'
import { getDb, type Db } from '../db'
import { newId } from '../ids'
import { AppError, invalid, notFound } from '../errors'
import { audit } from '../audit'
import { track } from '../analytics'
import { rateLimit } from '../ratelimit'
import { hmac, sha256, safeEqual } from '../secrets'
import { requireOrgPermission } from '../permissions'
import { queueEmail } from '../email'

/**
 * Event registration, tickets and check-in.
 * - A registration IS the ticket. Its token `reg_<id>.<sig>` is signed (HMAC) and only its hash is stored, so a
 *   guessed or tampered token is rejected before any database work and a leaked database can't mint tickets.
 * - Capacity is enforced inside one transaction holding the event row; the waitlist is the overflow.
 * - Check-in is one atomic UPDATE guarded by `checked_in_at IS NULL`: two scanners can't both admit a ticket.
 */

export interface RegistrationField { id: string; label: string; kind: 'text' | 'select' | 'checkbox'; required: boolean; options?: string[] }
export interface TicketType { id: string; name: string; price_label: string | null; quantity: number | null }

export interface PublicEvent {
  id: string; org_id: string; slug: string; name: string; description: string; venue: string; timezone: string
  starts_at: Date | null; ends_at: Date | null; capacity: number | null; registration_open: boolean; waitlist: boolean
  registration_fields: RegistrationField[]; ticket_types: TicketType[]; brand: Record<string, unknown>; org_name: string; status: string
  confirmed: number
}

export const ticketToken = (registrationId: string) => `${registrationId}.${hmac(`ticket:v1:${registrationId}`).slice(0, 22)}`
function parseTicket(token: string): string | null {
  if (typeof token !== 'string' || token.length > 80) return null
  const [id, sig] = token.split('.')
  if (!/^reg_[A-Za-z0-9_-]{6,40}$/.test(id ?? '') || !sig) return null
  return safeEqual(hmac(`ticket:v1:${id}`).slice(0, 22), sig) ? id : null
}

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60)

const detailsInput = z.object({
  slug: z.string().trim().max(60).optional(),
  description: z.string().trim().max(4000).default(''),
  timezone: z.string().trim().max(60).default('UTC'),
  startsAt: z.string().trim().max(40).nullable().default(null),
  endsAt: z.string().trim().max(40).nullable().default(null),
  capacity: z.number().int().positive().nullable().default(null),
  published: z.boolean().default(false),
  registrationOpen: z.boolean().default(true),
  waitlist: z.boolean().default(true),
  registrationFields: z.array(z.object({ id: z.string().regex(/^[a-z0-9_]{1,24}$/), label: z.string().trim().min(1).max(80), kind: z.enum(['text', 'select', 'checkbox']), required: z.boolean().default(false), options: z.array(z.string().max(60)).max(20).optional() })).max(12).default([]),
  ticketTypes: z.array(z.object({ id: z.string().regex(/^[a-z0-9_]{1,24}$/), name: z.string().trim().min(1).max(60), price_label: z.string().trim().max(30).nullable().default(null), quantity: z.number().int().positive().nullable().default(null) })).max(10).default([]),
})

export async function updateEventDetails(userId: string, eventId: string, input: z.input<typeof detailsInput>) {
  const r = detailsInput.safeParse(input)
  if (!r.success) throw invalid(r.error.issues[0].message)
  const db = await getDb()
  const [e] = await db.query<{ org_id: string; name: string; slug: string | null }>(`SELECT org_id, name, slug FROM events WHERE id = $1`, [eventId])
  if (!e) throw notFound('That event')
  await requireOrgPermission(db, userId, e.org_id, 'events.manage')
  const d = r.data
  const slug = slugify(d.slug || e.slug || e.name) || eventId.slice(4)
  const starts = d.startsAt ? new Date(d.startsAt) : null
  const ends = d.endsAt ? new Date(d.endsAt) : null
  if ((starts && isNaN(starts.getTime())) || (ends && isNaN(ends.getTime()))) throw invalid('Check the dates.')
  if (starts && ends && ends < starts) throw invalid('The end is before the start.')
  try {
    await db.query(
      `UPDATE events SET slug = $2, description = $3, timezone = $4, starts_at = $5::timestamptz, ends_at = $6::timestamptz, capacity = $7::int, published = $8, registration_open = $9, waitlist = $10,
              registration_fields = $11::jsonb, ticket_types = $12::jsonb, starts_on = coalesce(($5::timestamptz)::date, starts_on), ends_on = coalesce(($6::timestamptz)::date, ends_on)
        WHERE id = $1`,
      [eventId, slug, d.description, d.timezone, starts, ends, d.capacity, d.published, d.registrationOpen, d.waitlist, JSON.stringify(d.registrationFields), JSON.stringify(d.ticketTypes)],
    )
  } catch (err) {
    if (/unique|duplicate/i.test(String((err as Error).message))) throw new AppError('conflict', 'That web address is used by another event. Pick a different one.')
    throw err
  }
  await audit(db, { actor: userId, action: 'event.details_updated', targetType: 'event', targetId: eventId, orgId: e.org_id, meta: { published: d.published } })
  return slug
}

export async function publicEvent(slug: string): Promise<PublicEvent | null> {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null
  const db = await getDb()
  const [e] = await db.query<PublicEvent>(
    `SELECT e.id, e.org_id, e.slug, e.name, e.description, e.venue, e.timezone, e.starts_at, e.ends_at, e.capacity, e.registration_open, e.waitlist,
            e.registration_fields, e.ticket_types, e.brand, e.status, o.name AS org_name,
            (SELECT count(*)::int FROM registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') AS confirmed
       FROM events e JOIN organizations o ON o.id = e.org_id WHERE e.slug = $1 AND e.published`, [slug])
  return e ?? null
}

const registerInput = z.object({
  name: z.string().trim().min(2, 'Add your name.').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email.').max(254),
  company: z.string().trim().max(80).default(''),
  ticketTypeId: z.string().max(24).optional(),
  answers: z.record(z.string(), z.union([z.string().max(500), z.boolean()])).default({}),
})

/** Public. Idempotent per (event, email): registering twice re-sends the same ticket instead of leaking a second one. */
export async function registerForEvent(slug: string, input: z.input<typeof registerInput>, ctx: { ipKey: string; userId?: string | null; stationId?: string | null }) {
  const r = registerInput.safeParse(input)
  if (!r.success) throw invalid(r.error.issues[0].message)
  const db = await getDb()
  await rateLimit(db, `register:${ctx.ipKey}`, 60, 3600)
  const e = await publicEvent(slug)
  if (!e) throw notFound('That event')
  if (!e.registration_open || e.status === 'ended') throw new AppError('forbidden', 'Registration for this event is closed.')
  for (const f of e.registration_fields) {
    const v = r.data.answers[f.id]
    if (f.required && (v === undefined || v === '' || v === false)) throw invalid(`“${f.label}” is required.`)
    if (f.kind === 'select' && v !== undefined && v !== '' && !f.options?.includes(String(v))) throw invalid(`Choose one of the options for “${f.label}”.`)
  }
  const tt = e.ticket_types.length ? e.ticket_types.find((t) => t.id === r.data.ticketTypeId) ?? e.ticket_types[0] : null
  if (tt?.price_label) throw new AppError('forbidden', 'Paid tickets aren’t available yet — a payment provider must be configured first.')
  const answers = Object.fromEntries(Object.entries(r.data.answers).filter(([k]) => e.registration_fields.some((f) => f.id === k)))

  const [existing] = await db.query<{ id: string; status: string }>(`SELECT id, status FROM registrations WHERE event_id = $1 AND email = $2`, [e.id, r.data.email])
  if (existing && existing.status !== 'cancelled') {
    await sendTicketEmail(db, existing.id)
    return { registrationId: existing.id, status: existing.status as 'confirmed' | 'waitlisted', token: ticketToken(existing.id), already: true }
  }

  let status: 'confirmed' | 'waitlisted' = 'confirmed'
  let id = existing?.id ?? newId('reg')
  await db.tx(async (t) => {
    const [ev] = await t.query<{ capacity: number | null; waitlist: boolean }>(`SELECT capacity, waitlist FROM events WHERE id = $1 FOR UPDATE`, [e.id])
    const [{ n }] = await t.query<{ n: number }>(`SELECT count(*)::int AS n FROM registrations WHERE event_id = $1 AND status = 'confirmed'`, [e.id])
    const typeFull = tt?.quantity != null && (await t.query<{ n: number }>(`SELECT count(*)::int AS n FROM registrations WHERE event_id = $1 AND status = 'confirmed' AND ticket_type_id = $2`, [e.id, tt.id]))[0].n >= tt.quantity
    if ((ev.capacity != null && n >= ev.capacity) || typeFull) {
      if (!ev.waitlist) throw new AppError('forbidden', 'This event is full.')
      status = 'waitlisted'
    }
    if (existing) {
      await t.query(`UPDATE registrations SET status = $2, name = $3, company = $4, ticket_type_id = $5, answers = $6::jsonb, user_id = coalesce($7, user_id), token_hash = $8, checked_in_at = NULL, created_at = now() WHERE id = $1`,
        [existing.id, status, r.data.name, r.data.company, tt?.id ?? null, JSON.stringify(answers), ctx.userId ?? null, sha256(ticketToken(existing.id))])
    } else {
      id = newId('reg')
      await t.query(`INSERT INTO registrations (id, event_id, org_id, user_id, email, name, company, ticket_type_id, answers, status, token_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)`,
        [id, e.id, e.org_id, ctx.userId ?? null, r.data.email, r.data.name, r.data.company, tt?.id ?? null, JSON.stringify(answers), status, sha256(ticketToken(id))])
    }
    await audit(t, { actor: ctx.userId ?? null, action: 'registration.created', targetType: 'registration', targetId: id, orgId: e.org_id, meta: { status } })
    if (ctx.stationId) await t.query(`INSERT INTO station_interactions (id, station_id, org_id, kind) VALUES ($1,$2,$3,'registration')`, [newId('si'), ctx.stationId, e.org_id])
  })
  await track(db, 'event_registered', { orgId: e.org_id, props: { context_id: e.id, source: status } })
  await sendTicketEmail(db, id)
  const { fireTrigger } = await import('./automations')
  await fireTrigger(db, e.org_id, 'registration.created', id, { eventId: e.id, status, email: r.data.email, name: r.data.name })
  return { registrationId: id, status, token: ticketToken(id), already: false }
}

async function sendTicketEmail(db: Db, registrationId: string) {
  const [r] = await db.query<{ email: string; name: string; status: string; event_name: string; user_id: string | null; starts_at: Date | null; venue: string }>(
    `SELECT r.email, r.name, r.status, r.user_id, e.name AS event_name, e.starts_at, e.venue FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.id = $1`, [registrationId])
  if (!r) return
  const base = (process.env.ORYN_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const link = `${base}/ticket/${ticketToken(registrationId)}`
  if (r.status === 'waitlisted') {
    await queueEmail(db, { to: r.email, userId: r.user_id, kind: 'registration_waitlisted', subject: `You’re on the waitlist — ${r.event_name}`, text: `Hi ${r.name.split(' ')[0]},\n\n${r.event_name} is full right now. You’re on the waitlist; we’ll email you if a place opens.\n\nYour registration: ${link}` })
  } else {
    await queueEmail(db, { to: r.email, userId: r.user_id, kind: 'ticket', subject: `Your ticket — ${r.event_name}`, text: `Hi ${r.name.split(' ')[0]},\n\nYou’re registered for ${r.event_name}${r.venue ? ` at ${r.venue}` : ''}${r.starts_at ? ` on ${new Date(r.starts_at).toUTCString()}` : ''}.\n\nYour ticket (show the code at the door):\n${link}\n\nNeed to cancel? Open the same link.` })
  }
}

export async function ticketByToken(token: string) {
  const id = parseTicket(token)
  if (!id) return null
  const db = await getDb()
  const [t] = await db.query<{ id: string; name: string; email: string; company: string; status: string; checked_in_at: Date | null; ticket_type_id: string | null; event_name: string; slug: string; venue: string; starts_at: Date | null; ends_at: Date | null; timezone: string; ticket_types: TicketType[]; org_name: string }>(
    `SELECT r.id, r.name, r.email, r.company, r.status, r.checked_in_at, r.ticket_type_id, e.name AS event_name, e.slug, e.venue, e.starts_at, e.ends_at, e.timezone, e.ticket_types, o.name AS org_name
       FROM registrations r JOIN events e ON e.id = r.event_id JOIN organizations o ON o.id = e.org_id WHERE r.id = $1 AND r.token_hash = $2`, [id, sha256(token)])
  return t ?? null
}

export async function cancelRegistration(token: string) {
  const id = parseTicket(token)
  if (!id) throw notFound('That ticket')
  const db = await getDb()
  const [r] = await db.query<{ event_id: string; org_id: string; status: string }>(`UPDATE registrations SET status = 'cancelled' WHERE id = $1 AND token_hash = $2 AND status <> 'cancelled' AND checked_in_at IS NULL RETURNING event_id, org_id, status`, [id, sha256(token)])
  if (!r) throw new AppError('conflict', 'This registration can’t be cancelled (already used or already cancelled).')
  await audit(db, { actor: null, action: 'registration.cancelled', targetType: 'registration', targetId: id, orgId: r.org_id })
  // A place opened: promote the first person on the waitlist.
  const [next] = await db.query<{ id: string }>(`SELECT id FROM registrations WHERE event_id = $1 AND status = 'waitlisted' ORDER BY created_at LIMIT 1`, [r.event_id])
  if (next) {
    await db.query(`UPDATE registrations SET status = 'confirmed' WHERE id = $1`, [next.id])
    await sendTicketEmail(db, next.id)
  }
}

// ─── Organizer / staff ───────────────────────────────────────────────────────────────────────────

/** Staff = workspace members who may manage participants, or people added to the event with the staff role. */
export async function requireCheckInStaff(db: Db, userId: string, eventId: string) {
  const [e] = await db.query<{ org_id: string }>(`SELECT org_id FROM events WHERE id = $1`, [eventId])
  if (!e) throw notFound('That event')
  const [staff] = await db.query(`SELECT 1 FROM event_participants WHERE event_id = $1 AND user_id = $2 AND role = 'staff' AND status = 'active'`, [eventId, userId])
  if (staff) return e.org_id
  await requireOrgPermission(db, userId, e.org_id, 'checkin.perform')
  return e.org_id
}

export async function listRegistrations(userId: string, eventId: string, q = '') {
  const db = await getDb()
  await requireCheckInStaff(db, userId, eventId)
  return db.query<{ id: string; name: string; email: string; company: string; status: string; checked_in_at: Date | null; created_at: Date; ticket_type_id: string | null }>(
    `SELECT id, name, email, company, status, checked_in_at, created_at, ticket_type_id FROM registrations
      WHERE event_id = $1 AND ($2 = '' OR name ILIKE '%' || $2 || '%' OR email ILIKE '%' || $2 || '%' OR company ILIKE '%' || $2 || '%')
      ORDER BY created_at DESC LIMIT 500`, [eventId, q.slice(0, 60)])
}

export async function registrationStats(userId: string, eventId: string) {
  const db = await getDb()
  await requireCheckInStaff(db, userId, eventId)
  const [s] = await db.query<{ confirmed: number; waitlisted: number; cancelled: number; checked_in: number; last_hour: number }>(
    `SELECT count(*) FILTER (WHERE status = 'confirmed')::int AS confirmed, count(*) FILTER (WHERE status = 'waitlisted')::int AS waitlisted,
            count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled, count(*) FILTER (WHERE checked_in_at IS NOT NULL)::int AS checked_in,
            count(*) FILTER (WHERE checked_in_at > now() - interval '1 hour')::int AS last_hour
       FROM registrations WHERE event_id = $1`, [eventId])
  return s
}

export type CheckInResult = { status: 'ok'; name: string; company: string; registrationId: string } | { status: 'already'; name: string; at: Date } | { status: 'not_found' } | { status: 'cancelled' | 'waitlisted'; name: string }

/** Atomic: only the first scanner wins. `ref` is a ticket token (scan) or a registration id (manual). */
export async function checkIn(userId: string, eventId: string, ref: string, method: 'scan' | 'manual'): Promise<CheckInResult> {
  const db = await getDb()
  await requireCheckInStaff(db, userId, eventId)
  await rateLimit(db, `checkin:${userId}`, 1200, 3600)
  let id: string | null
  if (method === 'scan') {
    // Accept a full ticket URL or the bare token.
    const token = ref.includes('/ticket/') ? ref.split('/ticket/')[1].split(/[?#]/)[0] : ref
    id = parseTicket(token)
  } else id = /^reg_[A-Za-z0-9_-]{6,40}$/.test(ref) ? ref : null
  if (!id) return { status: 'not_found' }
  const [won] = await db.query<{ name: string; company: string }>(
    `UPDATE registrations SET checked_in_at = now(), checked_in_by = $3 WHERE id = $1 AND event_id = $2 AND status = 'confirmed' AND checked_in_at IS NULL RETURNING name, company`, [id, eventId, userId])
  if (won) {
    await db.query(`INSERT INTO check_ins (id, registration_id, event_id, staff_user_id, method) VALUES ($1,$2,$3,$4,$5)`, [newId('ci'), id, eventId, userId, method])
    await audit(db, { actor: userId, action: 'checkin.recorded', targetType: 'registration', targetId: id, meta: { method } })
    const [e] = await db.query<{ org_id: string }>(`SELECT org_id FROM events WHERE id = $1`, [eventId])
    await track(db, 'event_checked_in', { userId, orgId: e.org_id, props: { context_id: eventId, source: method } })
    const { fireTrigger } = await import('./automations')
    await fireTrigger(db, e.org_id, 'checkin.created', id, { eventId })
    return { status: 'ok', name: won.name, company: won.company, registrationId: id }
  }
  const [r] = await db.query<{ name: string; status: string; checked_in_at: Date | null }>(`SELECT name, status, checked_in_at FROM registrations WHERE id = $1 AND event_id = $2`, [id, eventId])
  if (!r) return { status: 'not_found' }
  if (r.checked_in_at) return { status: 'already', name: r.name, at: r.checked_in_at }
  return { status: r.status === 'cancelled' ? 'cancelled' : 'waitlisted', name: r.name }
}

export async function checkInHistory(userId: string, eventId: string, limit = 30) {
  const db = await getDb()
  await requireCheckInStaff(db, userId, eventId)
  return db.query<{ id: string; name: string; company: string; method: string; created_at: Date; staff: string | null }>(
    `SELECT c.id, r.name, r.company, c.method, c.created_at, u.display_name AS staff FROM check_ins c JOIN registrations r ON r.id = c.registration_id LEFT JOIN users u ON u.id = c.staff_user_id
      WHERE c.event_id = $1 ORDER BY c.created_at DESC LIMIT $2`, [eventId, limit])
}

/** For the signed-in attendee: their own registrations (e.g. to open a ticket from the app). */
export async function myRegistrations(userId: string) {
  const db = await getDb()
  const rows = await db.query<{ id: string; status: string; event_name: string; slug: string; starts_at: Date | null; checked_in_at: Date | null }>(
    `SELECT r.id, r.status, e.name AS event_name, e.slug, e.starts_at, r.checked_in_at FROM registrations r JOIN events e ON e.id = r.event_id
      WHERE r.user_id = $1 OR r.email = (SELECT email FROM users WHERE id = $1) ORDER BY r.created_at DESC LIMIT 20`, [userId])
  return rows.map((r) => ({ ...r, token: ticketToken(r.id) }))
}

/** Exports exist in CSV because organizers live in spreadsheets. Quoted, no formulas. */
export function toCsv(rows: Record<string, unknown>[], columns: string[]) {
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"` }
  return [columns.map(esc).join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\r\n')
}

