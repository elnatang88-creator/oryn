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
  return db.query<{ id: string; name: string; kind: string; status: string; code: string; capsule_name: string | null; event_name: string | null; opened: number; requests: number }>(
    `SELECT st.id, st.name, st.kind, st.status, q.code, c.name AS capsule_name, e.name AS event_name, s.view_count AS opened,
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
