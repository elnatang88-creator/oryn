import { describe, expect, it } from 'vitest'
import { makeUser, fields, db } from './helpers'
import { createCapsule } from '@/lib/server/services/capsules'
import { heartbeat, leaveNearby, nearbyState, requestNearby, setNearbyVisibility } from '@/lib/server/services/nearby'
import { listConnections, getConnection, listRequests, respondToRequest } from '@/lib/server/services/connections'
import { encodeCell, cellAndNeighbours, isCell } from '@/lib/geocell'
import { AppError } from '@/lib/server/errors'

// Two spots ~40 m apart in Tel Aviv, and one ~5 km away. Only the cells are ever sent.
const HERE = encodeCell(32.0853, 34.7818)
const NEXT_DOOR = encodeCell(32.0856, 34.7821)
const ACROSS_TOWN = encodeCell(32.1300, 34.8000)

async function member(name: string, visibility: 'everyone' | 'connections' | 'event' | 'off' = 'everyone') {
  const u = await makeUser('pro', name)
  await createCapsule(u.id, { name: 'Work', mode: 'professional', display_name: name, headline: 'Founder', fields: fields(), private_note: `PRIVATE-${name}` })
  await setNearbyVisibility(u.id, visibility)
  return u
}

describe('area cells', () => {
  it('encodes to a coarse 7-character cell; neighbours cover the next cell over', () => {
    expect(isCell(HERE)).toBe(true)
    expect(cellAndNeighbours(HERE)).toContain(NEXT_DOOR)
    expect(cellAndNeighbours(HERE)).not.toContain(ACROSS_TOWN)
    expect(isCell('demo')).toBe(false)
  })
})

describe('Nearby: discovery is opt-in and follows each person’s rule', () => {
  it('two visible members next to each other see each other; someone across town does not', async () => {
    const a = await member('Ada Near'), b = await member('Ben Near'), far = await member('Far Away')
    await heartbeat(a.id, { cell: HERE }); await heartbeat(b.id, { cell: NEXT_DOOR }); await heartbeat(far.id, { cell: ACROSS_TOWN })
    const s = await nearbyState(a.id)
    expect(s.people.map((p) => p.name)).toContain('Ben Near')
    expect(s.people.map((p) => p.name)).not.toContain('Far Away')
    // Only card-face data: no user ids, no details, no private note.
    const json = JSON.stringify(s)
    expect(json).not.toContain(b.id)
    expect(json).not.toContain('me@example.com')
    expect(json).not.toContain('555 010 9999')
    expect(json).not.toContain('PRIVATE-')
  })

  it('discoverability OFF really prevents discovery, and you must be visible to look', async () => {
    const a = await member('Ann Off'), hidden = await member('Hidden Person', 'off')
    expect(await heartbeat(hidden.id, { cell: HERE })).toMatchObject({ visible: false, reason: 'off' })
    await heartbeat(a.id, { cell: HERE })
    expect((await nearbyState(a.id)).people.map((p) => p.name)).not.toContain('Hidden Person')
    // Turning off removes you at once, even if a presence row existed.
    const c = await member('Cara Leaves')
    await heartbeat(c.id, { cell: HERE })
    expect((await nearbyState(a.id)).people.map((p) => p.name)).toContain('Cara Leaves')
    await setNearbyVisibility(c.id, 'off')
    expect((await nearbyState(a.id)).people.map((p) => p.name)).not.toContain('Cara Leaves')
    // A lurker who is not visible sees nobody.
    const lurker = await member('Lurker', 'off')
    expect((await nearbyState(lurker.id)).people).toHaveLength(0)
    await leaveNearby(a.id)
    expect((await nearbyState(a.id)).people).toHaveLength(0)
  })

  it('"My connections" members are visible only to people already in their People', async () => {
    const a = await member('Stranger A'), picky = await member('Picky P', 'connections')
    await heartbeat(a.id, { cell: HERE }); await heartbeat(picky.id, { cell: HERE })
    expect((await nearbyState(a.id)).people.map((p) => p.name)).not.toContain('Picky P')
    const d = await db()
    await d.query(`INSERT INTO connections (id, owner_user_id, contact_user_id, name, source) VALUES ('con_t_' || substr(md5(random()::text),1,8), $1, $2, 'Stranger A', 'manual')`, [picky.id, a.id])
    expect((await nearbyState(a.id)).people.map((p) => p.name)).toContain('Picky P')
  })

  it('rejects anything that looks like coordinates or a fake cell', async () => {
    const a = await member('Coords')
    await expect(heartbeat(a.id, { cell: '32.0853,34.7818' })).rejects.toThrow('isn’t valid')
    await expect(heartbeat(a.id, { cell: 'demo' })).rejects.toThrow('isn’t valid')
    expect(await heartbeat(a.id, {})).toMatchObject({ visible: false, reason: 'needs_location' })
  })
})

describe('Nearby: the exchange goes through the existing request → People pipeline', () => {
  it('A taps B, B accepts: both are in People with only what the other card permits', async () => {
    const a = await member('Avi Exchange'), b = await member('Bella Exchange')
    await heartbeat(a.id, { cell: HERE }); await heartbeat(b.id, { cell: HERE })
    const bHandle = (await nearbyState(a.id)).people.find((p) => p.name === 'Bella Exchange')!.handle
    const r = await requestNearby(a.id, bHandle)
    expect(r.status).toBe('requested')
    // B sees it in Nearby and in the ordinary requests list.
    const inbox = await nearbyState(b.id)
    expect(inbox.incoming.map((i) => i.name)).toEqual(['Avi Exchange'])
    expect((await listRequests(b.id)).map((x) => x.from_name)).toContain('Avi Exchange')
    // A sees "waiting".
    expect((await nearbyState(a.id)).outgoing[0]).toMatchObject({ name: 'Bella Exchange', status: 'waiting' })

    const { connectionId } = await respondToRequest(b.id, inbox.incoming[0].id, true)
    const bSide = await getConnection(b.id, connectionId!)
    expect(bSide.connection.name).toBe('Avi Exchange')
    expect(bSide.connection.source).toBe('nearby')
    const values = bSide.connection.contact.map((c) => c.value)
    expect(values).toContain('me@example.com') // instant
    expect(values.some((v) => /^https?:\/\/example\.com/.test(v))).toBe(true) // learn more
    expect(values).not.toContain('+1 555 010 9999') // hidden stays hidden
    expect(JSON.stringify(bSide)).not.toContain('PRIVATE-')
    const aPeople = await listConnections(a.id)
    expect(aPeople.map((c) => c.name)).toContain('Bella Exchange')
    expect((await nearbyState(a.id)).outgoing[0]).toMatchObject({ status: 'accepted' })
    expect((await nearbyState(a.id)).people.find((p) => p.name === 'Bella Exchange')!.relation).toBe('connected')
  })

  it('both tap each other: connected at once (mutual intent), no duplicate requests', async () => {
    const a = await member('Mutual A'), b = await member('Mutual B')
    await heartbeat(a.id, { cell: HERE }); await heartbeat(b.id, { cell: HERE })
    const hb = (await nearbyState(a.id)).people.find((p) => p.name === 'Mutual B')!.handle
    const ha = (await nearbyState(b.id)).people.find((p) => p.name === 'Mutual A')!.handle
    expect((await requestNearby(a.id, hb)).status).toBe('requested')
    expect((await requestNearby(a.id, hb)).status).toBe('requested') // idempotent
    expect((await requestNearby(b.id, ha)).status).toBe('connected')
    expect((await listConnections(a.id)).filter((c) => c.name === 'Mutual B')).toHaveLength(1)
    expect((await listConnections(b.id)).filter((c) => c.name === 'Mutual A')).toHaveLength(1)
  })

  it('"Not now" is silent: the requester keeps seeing "waiting"', async () => {
    const a = await member('Hopeful A'), b = await member('Busy B')
    await heartbeat(a.id, { cell: HERE }); await heartbeat(b.id, { cell: HERE })
    const hb = (await nearbyState(a.id)).people.find((p) => p.name === 'Busy B')!.handle
    await requestNearby(a.id, hb)
    const [req] = (await nearbyState(b.id)).incoming
    await respondToRequest(b.id, req.id, false)
    expect((await nearbyState(a.id)).outgoing[0].status).toBe('waiting')
    expect((await listConnections(a.id)).map((c) => c.name)).not.toContain('Busy B')
  })

  it('a handle is not enough: you can only request someone currently visible to you', async () => {
    const a = await member('Seeker'), b = await member('Target T'), outsider = await member('Outsider O')
    await heartbeat(a.id, { cell: HERE }); await heartbeat(b.id, { cell: HERE })
    const hb = (await nearbyState(a.id)).people.find((p) => p.name === 'Target T')!.handle
    // Not present at all.
    await expect(requestNearby(outsider.id, hb)).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'forbidden')
    // Present, but far away.
    await heartbeat(outsider.id, { cell: ACROSS_TOWN })
    await expect(requestNearby(outsider.id, hb)).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'not_found')
    // Garbage and user ids are refused.
    await expect(requestNearby(a.id, b.id)).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'not_found')
    // B goes invisible: the handle A already has stops working.
    await setNearbyVisibility(b.id, 'off')
    await expect(requestNearby(a.id, hb)).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'not_found')
  })

  it('only the person asked can answer a request', async () => {
    const a = await member('Asker'), b = await member('Asked'), mallory = await member('Mallory')
    await heartbeat(a.id, { cell: HERE }); await heartbeat(b.id, { cell: HERE })
    await requestNearby(a.id, (await nearbyState(a.id)).people.find((p) => p.name === 'Asked')!.handle)
    const [req] = (await nearbyState(b.id)).incoming
    await expect(respondToRequest(mallory.id, req.id, true)).rejects.toThrow()
    await expect(respondToRequest(a.id, req.id, true)).rejects.toThrow()
  })
})

describe('Nearby: stopping shares withdraws a pending offer', () => {
  it('if A stops all shares before B answers, B cannot receive A’s details', async () => {
    const { revokeAllShares } = await import('@/lib/server/services/sharing')
    const a = await member('Withdrawn A'), b = await member('Late B')
    await heartbeat(a.id, { cell: HERE }); await heartbeat(b.id, { cell: HERE })
    await requestNearby(a.id, (await nearbyState(a.id)).people.find((p) => p.name === 'Late B')!.handle)
    const [req] = (await nearbyState(b.id)).incoming
    await revokeAllShares(a.id)
    await expect(respondToRequest(b.id, req.id, true)).rejects.toThrow('no longer available')
    expect((await listConnections(b.id)).map((c) => c.name)).not.toContain('Withdrawn A')
  })
})
