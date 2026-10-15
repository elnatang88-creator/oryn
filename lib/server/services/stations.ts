import 'server-only'
import { z } from 'zod'
import { getDb } from '../db'
import { newCode, newId } from '../ids'
import { invalid, notFound } from '../errors'
import { audit } from '../audit'
import { track } from '../analytics'
import { orgPlan, requireCapability } from '../plans'
import { requireOrgPermission } from '../permissions'
import { signShareToken } from '../tokens'

/**
 * A Station is a fixed place (booth, desk, table, room, counter) with a printed QR/NFC code.
 * The printed code points to a QR destination, which points to a long-lived share session,
 * which points to a capsule. Staff can re-point the station without reprinting anything.
 */
const stationInput = z.object({
  name: z.string().trim().min(2, 'Name the station.').max(60),
  kind: z.enum(['booth', 'table', 'desk', 'room', 'counter', 'person']),
  capsuleId: z.string().min(1, 'Choose which capsule people will see.'),
  eventId: z.string().nullable().default(null),
})

async function ownCapsule(userId: string, capsuleId: string) {
  const db = await getDb()
  const [c] = await db.query<{ id: string; version: number }>(`SELECT id, version FROM capsules WHERE id = $1 AND owner_user_id = $2 AND status = 'active'`, [capsuleId, userId])
  if (!c) throw notFound('That capsule')
  return c
}

export async function createStation(userId: string, orgId: string, input: z.input<typeof stationInput>) {
  const r = stationInput.safeParse(input)
  if (!r.success) throw invalid(r.error.issues[0].message)
  const db = await getDb()
  await requireOrgPermission(db, userId, orgId, 'stations.manage')
  await requireCapability(db, await orgPlan(db, orgId), 'stations', userId)
  const capsule = await ownCapsule(userId, r.data.capsuleId)
  if (r.data.eventId) {
    const [ev] = await db.query(`SELECT 1 FROM events WHERE id = $1 AND org_id = $2`, [r.data.eventId, orgId])
    if (!ev) throw notFound('That event')
  }
  const stationId = newId('stn')
  const sessionId = newId('s', 16)
  const code = newCode()
  await db.tx(async (t) => {
    await t.query(`INSERT INTO stations (id, org_id, event_id, name, kind, capsule_id) VALUES ($1,$2,$3,$4,$5,$6)`, [stationId, orgId, r.data.eventId, r.data.name, r.data.kind, capsule.id])
    await t.query(
      `INSERT INTO share_sessions (id, capsule_id, owner_user_id, org_id, event_id, station_id, channel, scope, context_label, interaction_level, allow_expanded, last_capsule_version)
       VALUES ($1,$2,$3,$4,$5,$6,'station',$7,$8,'connect',true,$9)`,
      [sessionId, capsule.id, userId, orgId, r.data.eventId, stationId, r.data.eventId ? 'event' : 'public', r.data.name, capsule.version],
    )
    await t.query(`INSERT INTO qr_destinations (code, org_id, owner_user_id, station_id, share_session_id) VALUES ($1,$2,$3,$4,$5)`, [code, orgId, userId, stationId, sessionId])
    await audit(t, { actor: userId, action: 'station.created', targetType: 'station', targetId: stationId, orgId })
  })
  await track(db, 'station_created', { userId, orgId })
  return { stationId, code }
}

export async function listStations(userId: string, orgId: string) {
  const db = await getDb()
  await requireOrgPermission(db, userId, orgId, 'stations.view')
  return db.query<{ id: string; name: string; kind: string; status: string; code: string; capsule_name: string | null; event_name: string | null; opened: number; requests: number; mode: string; destination_url: string | null }>(
    `SELECT st.id, st.name, st.kind, st.status, st.mode, st.destination_url, q.code, c.name AS capsule_name, e.name AS event_name, s.view_count AS opened,
            (SELECT count(*)::int FROM connection_requests r WHERE r.share_session_id = s.id) AS requests
       FROM stations st JOIN qr_destinations q ON q.station_id = st.id JOIN share_sessions s ON s.id = q.share_session_id
       LEFT JOIN capsules c ON c.id = st.capsule_id LEFT JOIN events e ON e.id = st.event_id
      WHERE st.org_id = $1 ORDER BY st.created_at DESC`,
    [orgId],
  )
}

export async function reassignStation(userId: string, stationId: string, capsuleId: string) {
  const db = await getDb()
  const [st] = await db.query<{ org_id: string }>(`SELECT org_id FROM stations WHERE id = $1`, [stationId])
  if (!st) throw notFound('That station')
  await requireOrgPermission(db, userId, st.org_id, 'stations.manage')
  const capsule = await ownCapsule(userId, capsuleId)
  await db.tx(async (t) => {
    await t.query(`UPDATE stations SET capsule_id = $2 WHERE id = $1`, [stationId, capsule.id])
    await t.query(`UPDATE share_sessions SET capsule_id = $2, owner_user_id = $3 WHERE station_id = $1`, [stationId, capsule.id, userId])
    await t.query(`UPDATE qr_destinations SET owner_user_id = $2 WHERE station_id = $1`, [stationId, userId])
    await audit(t, { actor: userId, action: 'station.reassigned', targetType: 'station', targetId: stationId, orgId: st.org_id })
  })
}

export async function setStationActive(userId: string, stationId: string, active: boolean) {
  const db = await getDb()
  const [st] = await db.query<{ org_id: string }>(`SELECT org_id FROM stations WHERE id = $1`, [stationId])
  if (!st) throw notFound('That station')
  await requireOrgPermission(db, userId, st.org_id, 'stations.manage')
  await db.tx(async (t) => {
    await t.query(`UPDATE stations SET status = $2 WHERE id = $1`, [stationId, active ? 'active' : 'paused'])
    await t.query(`UPDATE qr_destinations SET active = $2 WHERE station_id = $1`, [stationId, active])
    await audit(t, { actor: userId, action: active ? 'station.resumed' : 'station.paused', targetType: 'station', targetId: stationId, orgId: st.org_id })
  })
}

/** Public: a printed code resolves to the station's share token, or a reason it can't. */
export async function resolveDestination(code: string): Promise<{ status: 'ok'; token: string; stationName: string } | { status: 'paused' | 'not_found' }> {
  if (!/^[a-z2-9]{6,16}$/.test(code)) return { status: 'not_found' }
  const db = await getDb()
  const [d] = await db.query<{ active: boolean; share_session_id: string; expires_at: Date | null; name: string; status: string }>(
    `SELECT q.active, q.share_session_id, s.expires_at, st.name, st.status FROM qr_destinations q JOIN share_sessions s ON s.id = q.share_session_id LEFT JOIN stations st ON st.id = q.station_id WHERE q.code = $1`,
    [code],
  )
  if (!d) return { status: 'not_found' }
  if (!d.active || d.status === 'paused') return { status: 'paused' }
  return { status: 'ok', token: signShareToken(d.share_session_id, d.expires_at), stationName: d.name }
}

// ─── Stations v2: modes, remote destinations, scan analytics, transfer ──────────────────────────────

export const STATION_MODES = ['card', 'lead', 'registration', 'checkin', 'booking', 'link'] as const
export type StationMode = (typeof STATION_MODES)[number]
export const MODE_LABEL: Record<StationMode, string> = { card: 'Digital card', lead: 'Lead capture', registration: 'Event registration', checkin: 'Event check-in', booking: 'Meeting booking', link: 'Custom page' }

/** External destinations must be https and must not point back into private networks. Validated on save AND on resolve. */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  let u: URL
  try { u = new URL(raw.trim()) } catch { return null }
  if (u.protocol !== 'https:') return null
  if (u.username || u.password) return null
  const host = u.hostname.toLowerCase()
  if (host === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.endsWith('.local') || host.endsWith('.internal') || host.includes(':')) return null
  return u.toString().slice(0, 500)
}

const configInput = z.object({
  mode: z.enum(STATION_MODES),
  destinationUrl: z.string().trim().max(500).nullable().default(null),
  eventId: z.string().max(40).nullable().default(null),
  capsuleId: z.string().max(40).nullable().default(null),
  headline: z.string().trim().max(80).default(''),
  prompt: z.string().trim().max(200).default(''),
})

export async function configureStation(userId: string, stationId: string, input: z.input<typeof configInput>) {
  const r = configInput.safeParse(input)
  if (!r.success) throw invalid(r.error.issues[0].message)
  const db = await getDb()
  const [st] = await db.query<{ org_id: string }>(`SELECT org_id FROM stations WHERE id = $1`, [stationId])
  if (!st) throw notFound('That station')
  await requireOrgPermission(db, userId, st.org_id, 'stations.manage')
  const d = r.data
  let dest: string | null = null
  if (d.mode === 'booking' || d.mode === 'link') {
    dest = safeExternalUrl(d.destinationUrl)
    if (!dest) throw invalid('Give a full https:// web address.')
  }
  if (d.eventId) {
    const [e] = await db.query(`SELECT 1 FROM events WHERE id = $1 AND org_id = $2`, [d.eventId, st.org_id])
    if (!e) throw notFound('That event')
  }
  if ((d.mode === 'registration' || d.mode === 'checkin') && !d.eventId) throw invalid('Choose the event for this station.')
  if (d.capsuleId) await reassignStation(userId, stationId, d.capsuleId)
  await db.query(`UPDATE stations SET mode = $2, destination_url = $3, event_id = coalesce($4, event_id), config = $5::jsonb WHERE id = $1`,
    [stationId, d.mode, dest, d.eventId, JSON.stringify({ headline: d.headline, prompt: d.prompt })])
  await audit(db, { actor: userId, action: 'station.configured', targetType: 'station', targetId: stationId, orgId: st.org_id, meta: { mode: d.mode } })
}

export interface StationResolution {
  status: 'ok'; stationId: string; orgId: string; orgName: string; stationName: string; mode: StationMode; token: string | null
  eventId: string | null; eventSlug: string | null; destinationUrl: string | null; config: { headline?: string; prompt?: string }
}

/** Public. One printed URL serves NFC and QR; what it does is whatever the owner set most recently. Every tap is counted (no personal data). */
export async function resolveStation(code: string): Promise<StationResolution | { status: 'paused' | 'not_found' }> {
  if (!/^[a-z2-9]{6,16}$/.test(code)) return { status: 'not_found' }
  const db = await getDb()
  const [d] = await db.query<{ active: boolean; share_session_id: string; expires_at: Date | null; station_id: string | null; name: string; status: string; mode: StationMode; org_id: string; org_name: string; event_id: string | null; event_slug: string | null; destination_url: string | null; config: { headline?: string; prompt?: string } }>(
    `SELECT q.active, q.share_session_id, s.expires_at, st.id AS station_id, st.name, st.status, st.mode, st.org_id, o.name AS org_name, st.event_id, e.slug AS event_slug, st.destination_url, st.config
       FROM qr_destinations q JOIN share_sessions s ON s.id = q.share_session_id JOIN stations st ON st.id = q.station_id JOIN organizations o ON o.id = st.org_id
       LEFT JOIN events e ON e.id = st.event_id WHERE q.code = $1`, [code])
  if (!d || !d.station_id) return { status: 'not_found' }
  if (!d.active || d.status === 'paused') return { status: 'paused' }
  await db.query(`INSERT INTO station_interactions (id, station_id, org_id, kind) VALUES ($1,$2,$3,'scan')`, [newId('si'), d.station_id, d.org_id])
  await track(db, 'station_scanned', { orgId: d.org_id, props: { source: d.mode } })
  return {
    status: 'ok', stationId: d.station_id, orgId: d.org_id, orgName: d.org_name, stationName: d.name, mode: d.mode,
    token: signShareToken(d.share_session_id, d.expires_at), eventId: d.event_id, eventSlug: d.event_slug,
    destinationUrl: safeExternalUrl(d.destination_url), config: d.config ?? {},
  }
}

export async function stationAnalytics(userId: string, orgId: string, days = 30) {
  const db = await getDb()
  await requireOrgPermission(db, userId, orgId, 'stations.view')
  return db.query<{ station_id: string; name: string; mode: StationMode; scans: number; leads: number; registrations: number; links: number; last_scan: Date | null }>(
    `SELECT st.id AS station_id, st.name, st.mode,
            count(i.id) FILTER (WHERE i.kind = 'scan')::int AS scans, count(i.id) FILTER (WHERE i.kind = 'lead')::int AS leads,
            count(i.id) FILTER (WHERE i.kind = 'registration')::int AS registrations, count(i.id) FILTER (WHERE i.kind IN ('link','booking'))::int AS links,
            max(i.created_at) FILTER (WHERE i.kind = 'scan') AS last_scan
       FROM stations st LEFT JOIN station_interactions i ON i.station_id = st.id AND i.created_at > now() - make_interval(days => $2)
      WHERE st.org_id = $1 GROUP BY st.id, st.name, st.mode ORDER BY scans DESC`, [orgId, days])
}

/** Transfer: the owning workspace issues a one-time code; the receiving workspace redeems it. Nobody else can move a station. */
export async function startStationTransfer(userId: string, stationId: string) {
  const db = await getDb()
  const [st] = await db.query<{ org_id: string }>(`SELECT org_id FROM stations WHERE id = $1`, [stationId])
  if (!st) throw notFound('That station')
  await requireOrgPermission(db, userId, st.org_id, 'org.manage')
  const code = newCode(10)
  const { sha256 } = await import('../secrets')
  await db.query(`UPDATE stations SET transfer_code_hash = $2 WHERE id = $1`, [stationId, sha256(code)])
  await audit(db, { actor: userId, action: 'station.transfer_started', targetType: 'station', targetId: stationId, orgId: st.org_id })
  return code
}

export async function acceptStationTransfer(userId: string, toOrgId: string, code: string) {
  const db = await getDb()
  await requireOrgPermission(db, userId, toOrgId, 'org.manage')
  const { sha256 } = await import('../secrets')
  const [st] = await db.query<{ id: string; org_id: string }>(`SELECT id, org_id FROM stations WHERE transfer_code_hash = $1`, [sha256(code.trim().toLowerCase())])
  if (!st) throw notFound('That transfer code')
  await db.tx(async (t) => {
    await t.query(`UPDATE stations SET org_id = $2, transfer_code_hash = NULL, event_id = NULL, mode = 'card' WHERE id = $1`, [st.id, toOrgId])
    await t.query(`UPDATE qr_destinations SET org_id = $2, owner_user_id = $3 WHERE station_id = $1`, [st.id, toOrgId, userId])
    await t.query(`UPDATE share_sessions SET org_id = $2, owner_user_id = $3, event_id = NULL WHERE station_id = $1`, [st.id, toOrgId, userId])
    await audit(t, { actor: userId, action: 'station.transferred', targetType: 'station', targetId: st.id, orgId: toOrgId, meta: { from: st.org_id } })
  })
  return st.id
}
