import 'server-only'
import { getDb, type Db } from '../db'
import { newId } from '../ids'
import { AppError, invalid, notFound } from '../errors'
import { audit } from '../audit'
import { track } from '../analytics'
import { rateLimit } from '../ratelimit'
import { cellAndNeighbours, isCell } from '../../geocell'
import { normalizeDesign, type CardDesign } from '../../card-design'
import { defaultCapsuleId, type Capsule } from './capsules'
import { startShare } from './sharing'
import { respondToRequest } from './connections'

/**
 * ORYN-to-ORYN Nearby.
 *
 * WORKING: opt-in visibility, coarse-cell or same-event matching, member-to-member requests that land in the
 * existing request → People pipeline, mutual exchange of what each card permits.
 * NOT PRESENT YET (integration required): push/realtime transport (clients poll every few seconds), BLE/UWB
 * proximity (needs native apps). DEMO ONLY: fictional demo members visible only to demo accounts.
 */
export const VISIBILITIES = ['off', 'everyone', 'connections', 'event'] as const
export type NearbyVisibility = (typeof VISIBILITIES)[number]
export const PRESENCE_TTL_SECONDS = 120
export const DEMO_CELL = 'demo' // never a valid geohash cell, so no real person can join it

export interface NearbyCard { displayName: string; headline: string; company: string | null; avatarUrl: string | null; design: CardDesign }
export interface NearbyPerson {
  handle: string; name: string; headline: string; industry: string | null; proximity: string; isDemo: boolean
  card: NearbyCard; relation: 'none' | 'connected' | 'requested' | 'requested_you'; connectionId: string | null
}

/** Only what's printed on the card face (first layer) — never details, notes or links. */
function cardFace(capsule: Pick<Capsule, 'display_name' | 'headline' | 'avatar_url' | 'fields' | 'design'>): NearbyCard {
  const company = capsule.fields.find((f) => f.kind === 'company' && f.layer === 'instant' && f.value)?.value ?? null
  return { displayName: capsule.display_name, headline: capsule.headline, company, avatarUrl: capsule.avatar_url, design: normalizeDesign(capsule.design) }
}

async function viewerIsDemo(db: Db, userId: string) {
  const [u] = await db.query<{ demo: boolean }>(`SELECT email LIKE '%@oryn.local' AS demo FROM users WHERE id = $1`, [userId])
  return !!u?.demo
}

export async function liveEventsFor(db: Db, userId: string) {
  return db.query<{ id: string; name: string }>(
    `SELECT e.id, e.name FROM events e WHERE e.status = 'live' AND (
       EXISTS (SELECT 1 FROM memberships m WHERE m.org_id = e.org_id AND m.user_id = $1)
       OR EXISTS (SELECT 1 FROM event_participants p WHERE p.event_id = e.id AND p.user_id = $1 AND p.status <> 'removed'))
     ORDER BY e.name`, [userId])
}

export async function getNearbySettings(userId: string) {
  const db = await getDb()
  const [u] = await db.query<{ nearby_visibility: NearbyVisibility }>(`SELECT nearby_visibility FROM users WHERE id = $1`, [userId])
  return { visibility: u.nearby_visibility, events: await liveEventsFor(db, userId) }
}

export async function setNearbyVisibility(userId: string, visibility: string) {
  if (!VISIBILITIES.includes(visibility as NearbyVisibility)) throw invalid('Choose who can see you.')
  const db = await getDb()
  await db.query(`UPDATE users SET nearby_visibility = $2 WHERE id = $1`, [userId, visibility])
  if (visibility === 'off') await db.query(`DELETE FROM nearby_presence WHERE user_id = $1`, [userId])
  else await db.query(`UPDATE nearby_presence SET visibility = $2 WHERE user_id = $1`, [userId, visibility])
  await audit(db, { actor: userId, action: 'nearby.visibility_changed', targetType: 'user', targetId: userId, meta: { visibility } })
  await track(db, 'privacy_control_used', { userId, props: { control: 'nearby_visibility', value: visibility } })
  await track(db, visibility === 'off' ? 'nearby_visibility_disabled' : 'nearby_visibility_enabled', { userId, props: { source: visibility } })
}

/** Keeps me discoverable for the next two minutes. The client sends a coarse cell (never coordinates) and/or an event. */
export async function heartbeat(userId: string, input: { cell?: unknown; eventId?: unknown }) {
  const db = await getDb()
  await rateLimit(db, `nearby-hb:${userId}`, 600, 3600)
  const [u] = await db.query<{ nearby_visibility: NearbyVisibility }>(`SELECT nearby_visibility FROM users WHERE id = $1 AND deleted_at IS NULL`, [userId])
  if (!u || u.nearby_visibility === 'off') return { visible: false as const, reason: 'off' as const }
  const cell = input.cell == null || input.cell === '' ? null : isCell(input.cell) ? input.cell : null
  if (input.cell && !cell) throw invalid('That location cell isn’t valid.')
  let eventId: string | null = null
  if (typeof input.eventId === 'string' && input.eventId) {
    if (!(await liveEventsFor(db, userId)).some((e) => e.id === input.eventId)) throw notFound('That event')
    eventId = input.eventId
  }
  if (u.nearby_visibility === 'event' && !eventId) return { visible: false as const, reason: 'needs_event' as const }
  if (!cell && !eventId) return { visible: false as const, reason: 'needs_location' as const }
  const capsuleId = await defaultCapsuleId(userId)
  if (!capsuleId) return { visible: false as const, reason: 'no_card' as const }
  const [row] = await db.query<{ handle: string }>(
    `INSERT INTO nearby_presence (user_id, handle, capsule_id, cell, event_id, visibility, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6, now() + make_interval(secs => $7))
     ON CONFLICT (user_id) DO UPDATE SET capsule_id = EXCLUDED.capsule_id, cell = EXCLUDED.cell, event_id = EXCLUDED.event_id,
       visibility = EXCLUDED.visibility, expires_at = EXCLUDED.expires_at
     RETURNING handle`,
    [userId, newId('nb', 18), capsuleId, cell, eventId, u.nearby_visibility, PRESENCE_TTL_SECONDS],
  )
  return { visible: true as const, handle: row.handle }
}

export async function leaveNearby(userId: string) {
  const db = await getDb()
  await db.query(`DELETE FROM nearby_presence WHERE user_id = $1`, [userId])
}

interface Candidate { handle: string; user_id: string; capsule: Capsule; event_id: string | null; event_name: string | null; cell: string | null; name: string; headline: string; industry: string | null; demo: boolean }

/**
 * Everyone I may see right now. Both sides must be present; the other person's own visibility rule decides
 * (everyone / only their connections / only people at the same event). Optionally narrowed to one handle.
 */
async function candidates(db: Db, me: string, handle?: string): Promise<{ mine: { event_id: string | null; cell: string | null } | null; people: Candidate[] }> {
  const [mine] = await db.query<{ event_id: string | null; cell: string | null }>(`SELECT event_id, cell FROM nearby_presence WHERE user_id = $1 AND expires_at > now()`, [me])
  if (!mine) return { mine: null, people: [] }
  const cells = mine.cell ? cellAndNeighbours(mine.cell) : []
  const demo = await viewerIsDemo(db, me)
  const people = await db.query<Candidate>(
    `SELECT p.handle, p.user_id, to_jsonb(c.*) AS capsule, p.event_id, e.name AS event_name, p.cell,
            u.display_name AS name, u.profile_headline AS headline, u.industry, (u.email LIKE '%@oryn.local') AS demo
       FROM nearby_presence p JOIN users u ON u.id = p.user_id JOIN capsules c ON c.id = p.capsule_id AND c.status = 'active'
       LEFT JOIN events e ON e.id = p.event_id
      WHERE p.user_id <> $1 AND p.expires_at > now() AND u.deleted_at IS NULL AND u.nearby_visibility <> 'off'
        AND ($5::text IS NULL OR p.handle = $5)
        AND (
          (p.event_id IS NOT NULL AND p.event_id = $2)
          OR (p.visibility <> 'event' AND p.cell = ANY($3::text[]))
          OR ($4 AND p.cell = '${DEMO_CELL}')
        )
        AND (
          p.visibility = 'everyone'
          OR (p.visibility = 'event' AND p.event_id = $2)
          OR (p.visibility = 'connections' AND EXISTS (SELECT 1 FROM connections k WHERE k.owner_user_id = p.user_id AND k.contact_user_id = $1 AND k.status = 'active'))
        )
      ORDER BY (p.event_id IS NOT NULL AND p.event_id = $2) DESC, p.started_at DESC
      LIMIT 60`,
    [me, mine.event_id, cells, demo, handle ?? null],
  )
  return { mine, people }
}

function proximityLabel(c: Candidate, mine: { event_id: string | null }) {
  if (c.demo && c.cell === DEMO_CELL) return 'Nearby · demo'
  if (c.event_id && c.event_id === mine.event_id) return `At ${c.event_name ?? 'this event'}`
  return 'Nearby'
}

/** The full Nearby screen state: me, people around me, requests to me and from me. */
export async function nearbyState(me: string) {
  const db = await getDb()
  await simulateDemoReplies(db, me)
  const [u] = await db.query<{ nearby_visibility: NearbyVisibility }>(`SELECT nearby_visibility FROM users WHERE id = $1`, [me])
  const { mine, people } = await candidates(db, me)
  const ids = people.map((p) => p.user_id)
  const connected = ids.length ? await db.query<{ contact_user_id: string; id: string }>(`SELECT contact_user_id, id FROM connections WHERE owner_user_id = $1 AND status = 'active' AND contact_user_id = ANY($2::text[])`, [me, ids]) : []
  const mineOut = await db.query<{ owner_user_id: string }>(`SELECT owner_user_id FROM connection_requests WHERE from_user_id = $1 AND kind = 'member' AND status IN ('pending','declined') AND created_at > now() - interval '1 day'`, [me])
  const toMe = await db.query<{ from_user_id: string }>(`SELECT from_user_id FROM connection_requests WHERE owner_user_id = $1 AND kind = 'member' AND status = 'pending'`, [me])
  const list: NearbyPerson[] = people.map((p) => {
    const con = connected.find((c) => c.contact_user_id === p.user_id)
    const relation = con ? 'connected' : toMe.some((r) => r.from_user_id === p.user_id) ? 'requested_you' : mineOut.some((r) => r.owner_user_id === p.user_id) ? 'requested' : 'none'
    return { handle: p.handle, name: p.capsule.display_name || p.name, headline: p.headline || p.capsule.headline, industry: p.industry, proximity: proximityLabel(p, mine!), isDemo: p.demo, card: cardFace(p.capsule), relation, connectionId: con?.id ?? null }
  })
  return { visibility: u.nearby_visibility, present: !!mine, eventId: mine?.event_id ?? null, people: list, incoming: await incomingMember(db, me), outgoing: await outgoingMember(db, me) }
}

/** Member requests waiting for me, with the requester's card face so I know who it is. */
async function incomingMember(db: Db, me: string) {
  const rows = await db.query<{ id: string; from_name: string; created_at: Date; capsule: Capsule; headline: string; industry: string | null }>(
    `SELECT r.id, r.from_name, r.created_at, to_jsonb(c.*) AS capsule, u.profile_headline AS headline, u.industry
       FROM connection_requests r JOIN share_sessions s ON s.id = r.share_session_id JOIN capsules c ON c.id = s.capsule_id JOIN users u ON u.id = r.from_user_id
      WHERE r.owner_user_id = $1 AND r.kind = 'member' AND r.status = 'pending' AND u.deleted_at IS NULL
      ORDER BY r.created_at DESC LIMIT 10`, [me])
  return rows.map((r) => ({ id: r.id, name: r.from_name, headline: r.headline || r.capsule.headline, industry: r.industry, createdAt: r.created_at, card: cardFace(r.capsule) }))
}

/** My recent requests. A decline is private to them, so it reads exactly like "still waiting". */
async function outgoingMember(db: Db, me: string) {
  // Names come from the card the other person is showing (or the card they gave me), never their account name,
  // so requester, recipient, confirmation and People always agree.
  const rows = await db.query<{ id: string; status: string; name: string; connection_id: string | null; conn_name: string | null; card: NearbyCard | null }>(
    `SELECT r.id, r.status, coalesce(pc.display_name, u.display_name) AS name, k.id AS connection_id, k.name AS conn_name, k.card
       FROM connection_requests r JOIN users u ON u.id = r.owner_user_id
       LEFT JOIN nearby_presence p ON p.user_id = r.owner_user_id LEFT JOIN capsules pc ON pc.id = p.capsule_id
       LEFT JOIN LATERAL (SELECT k.id, k.name, k.card FROM connections k WHERE k.owner_user_id = $1 AND k.contact_user_id = r.owner_user_id AND k.status = 'active' ORDER BY k.created_at DESC LIMIT 1) k ON true
      WHERE r.from_user_id = $1 AND r.kind = 'member' AND r.created_at > now() - interval '1 day'
      ORDER BY r.created_at DESC LIMIT 10`, [me])
  return rows.map((r) => {
    const accepted = r.status === 'accepted'
    return { id: r.id, name: accepted && r.conn_name ? r.conn_name : r.name, status: accepted ? ('accepted' as const) : ('waiting' as const), connectionId: accepted ? r.connection_id : null, card: accepted && r.card ? { ...r.card, avatarUrl: null, design: normalizeDesign(r.card.design) } : null }
  })
}

/**
 * A taps B. Only possible while A is present and B is currently visible to A (checked here, on the server —
 * a handle alone is not enough, which also stops anyone enumerating members). If B already asked A, this is
 * mutual intent and the two are connected at once.
 */
export async function requestNearby(me: string, handle: string) {
  if (typeof handle !== 'string' || !/^nb_[A-Za-z0-9_-]{6,40}$/.test(handle)) throw notFound('That person')
  const db = await getDb()
  const { mine, people } = await candidates(db, me, handle)
  if (!mine) throw new AppError('forbidden', 'Turn on Nearby to connect with people around you.')
  const target = people[0]
  if (!target) throw new AppError('not_found', 'That person is no longer nearby.')
  await rateLimit(db, `nearby-connect:${me}`, 60, 3600)

  const [existing] = await db.query<{ id: string }>(`SELECT id FROM connections WHERE owner_user_id = $1 AND contact_user_id = $2 AND status = 'active'`, [me, target.user_id])
  if (existing) return { status: 'connected' as const, connectionId: existing.id }
  const [theirs] = await db.query<{ id: string }>(`SELECT id FROM connection_requests WHERE owner_user_id = $1 AND from_user_id = $2 AND kind = 'member' AND status = 'pending'`, [me, target.user_id])
  if (theirs) {
    const { connectionId } = await respondToRequest(me, theirs.id, true)
    return { status: 'connected' as const, connectionId }
  }
  const [pending] = await db.query<{ id: string }>(`SELECT id FROM connection_requests WHERE owner_user_id = $1 AND from_user_id = $2 AND kind = 'member' AND status = 'pending'`, [target.user_id, me])
  if (pending) return { status: 'requested' as const, requestId: pending.id }
  await rateLimit(db, `nearby-pair:${me}:${target.user_id}`, 3, 86400)

  const [myPresence] = await db.query<{ capsule_id: string }>(`SELECT capsule_id FROM nearby_presence WHERE user_id = $1`, [me])
  // The name on the card I'm offering is the name they'll see everywhere in this exchange.
  const [meRow] = await db.query<{ display_name: string }>(`SELECT c.display_name FROM capsules c WHERE c.id = $1`, [myPresence.capsule_id])
  // What I'm offering: a share of my current card. Its link is never sent anywhere; it scopes what they receive.
  const share = await startShare(me, { capsuleId: myPresence.capsule_id, channel: 'nearby', contextLabel: target.event_name ?? 'Nearby', durationMinutes: null, oneTime: false })
  const requestId = newId('req')
  await db.tx(async (t) => {
    const recipientId = newId('rcp')
    await t.query(`INSERT INTO recipients (id, user_id, name, contact) VALUES ($1,$2,$3,'')`, [recipientId, me, meRow.display_name])
    await t.query(`INSERT INTO connection_requests (id, share_session_id, owner_user_id, recipient_id, from_name, from_contact, message, kind, from_user_id) VALUES ($1,$2,$3,$4,$5,'','','member',$6)`,
      [requestId, share.id, target.user_id, recipientId, meRow.display_name, me])
    await t.query(`INSERT INTO notifications (id, user_id, kind, body, link) VALUES ($1,$2,'connect_request',$3,'/share/nearby')`, [newId('ntf'), target.user_id, `${meRow.display_name} would like to connect.`])
    await audit(t, { actor: me, action: 'connection_request.sent', targetType: 'connection_request', targetId: requestId, meta: { via: 'nearby' } })
  })
  await track(db, 'connect_requested', { userId: me, props: { via: 'nearby', channel: 'nearby', card_id: myPresence.capsule_id } })
  return { status: 'requested' as const, requestId }
}

/**
 * DEMO SIMULATION ONLY. Fictional demo members (on the reserved @oryn.local domain, visible only to demo
 * accounts) accept a request after ~2 seconds so one person can try the full exchange. Never runs for real users.
 */
async function simulateDemoReplies(db: Db, me: string) {
  const due = await db.query<{ id: string; owner_user_id: string }>(
    `SELECT r.id, r.owner_user_id FROM connection_requests r JOIN users u ON u.id = r.owner_user_id JOIN users f ON f.id = r.from_user_id
       JOIN nearby_presence p ON p.user_id = r.owner_user_id AND p.cell = '${DEMO_CELL}'
      WHERE r.from_user_id = $1 AND r.kind = 'member' AND r.status = 'pending' AND u.email LIKE '%@oryn.local' AND f.email LIKE '%@oryn.local'
        AND r.created_at < now() - interval '2 seconds'`, [me])
  for (const r of due) await respondToRequest(r.owner_user_id, r.id, true)
}
