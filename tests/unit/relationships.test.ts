import { describe, expect, it } from 'vitest'
import { makeUser, fields, db } from './helpers'
import { createCapsule, setDefaultCapsule, getCapsule } from '@/lib/server/services/capsules'
import { startShare, resolveShare, requestConnection } from '@/lib/server/services/sharing'
import { addNote, addFollowUp, getConnection, listConnections, listRequests, respondToRequest, setConnectionTags } from '@/lib/server/services/connections'
import { heartbeat, nearbyState, requestNearby, setNearbyVisibility } from '@/lib/server/services/nearby'
import { relationshipSummary } from '@/lib/server/services/today'
import { walletLink } from '@/lib/server/services/wallet-pass'
import { cardFor } from '@/lib/server/services/owner-card'
import { recordMemberView } from '@/lib/server/services/viewers'
import { cleanProps } from '@/lib/analytics-events'
import { encodeCell } from '@/lib/geocell'

const HERE = encodeCell(32.0853, 34.7818)

async function withCard(name: string, cardName = 'Work', display = name) {
  const u = await makeUser('pro', name)
  const capsuleId = await createCapsule(u.id, { name: cardName, mode: 'professional', display_name: display, headline: 'Founder', fields: [...fields(), { id: 'f_comp01', kind: 'company' as const, label: 'Company', value: `${name} Labs`, layer: 'instant' as const }] })
  return { ...u, capsuleId }
}

describe('relationship memory: every connection remembers how it happened', () => {
  it('link request: remembers which of my cards and which channel', async () => {
    const me = await withCard('Owner Attribution', 'Conference')
    const share = await startShare(me.id, { capsuleId: me.capsuleId, channel: 'qr', contextLabel: 'Hall C' })
    await requestConnection(share.token, { name: 'Link Person', contact: 'link@example.com', message: '' }, { claimToken: 'c1', ipKey: 'attr-1' })
    const [req] = await listRequests(me.id)
    const { connectionId } = await respondToRequest(me.id, req.id, true)
    const { connection } = await getConnection(me.id, connectionId!)
    expect(connection).toMatchObject({ my_capsule_id: me.capsuleId, channel: 'qr' })
  })

  it('Nearby: both sides keep the other card’s face, the card they used, and the channel; names match the card', async () => {
    const a = await withCard('Alpha Account', 'Conference', 'Alpha On Card')
    const b = await withCard('Beta Account', 'Work', 'Beta On Card')
    for (const u of [a, b]) { await setNearbyVisibility(u.id, 'everyone'); await heartbeat(u.id, { cell: HERE }) }
    const seen = (await nearbyState(a.id)).people.find((p) => p.name === 'Beta On Card')
    expect(seen).toBeTruthy() // the name shown is the name on the card, not the account name
    await requestNearby(a.id, seen!.handle)
    const [inc] = (await nearbyState(b.id)).incoming
    expect(inc.name).toBe('Alpha On Card')
    const { connectionId } = await respondToRequest(b.id, inc.id, true)
    const bSide = (await getConnection(b.id, connectionId!)).connection
    expect(bSide).toMatchObject({ name: 'Alpha On Card', channel: 'nearby', my_capsule_id: b.capsuleId })
    expect(bSide.card).toMatchObject({ displayName: 'Alpha On Card', company: 'Alpha Account Labs' })
    const aSide = (await listConnections(a.id)).find((c) => c.contact_user_id === b.id)!
    expect(aSide).toMatchObject({ name: 'Beta On Card', channel: 'nearby', my_capsule_id: a.capsuleId })
    const out = (await nearbyState(a.id)).outgoing[0]
    expect(out).toMatchObject({ name: 'Beta On Card', status: 'accepted' })
    expect(out.card?.displayName).toBe('Beta On Card')
    expect(JSON.stringify(bSide.card)).not.toContain('555 010 9999')
  })
})

describe('People search is memory, and private to its owner', () => {
  it('finds by company, event/place, tag and my own notes — never someone else’s notes', async () => {
    const me = await withCard('Searcher')
    const other = await withCard('Other Owner')
    const d = await db()
    const mk = async (owner: string, name: string, extra: Record<string, unknown> = {}) => {
      const id = `con_s_${Math.random().toString(36).slice(2, 10)}`
      await d.query(`INSERT INTO connections (id, owner_user_id, name, source, met_where, card) VALUES ($1,$2,$3,'manual',$4,$5::jsonb)`, [id, owner, name, extra.met ?? '', JSON.stringify(extra.card ?? null)])
      return id
    }
    const dana = await mk(me.id, 'Dana Investor', { met: 'Carmel Ventures Conference', card: { displayName: 'Dana', headline: '', company: 'Cedar Fund', design: {} } })
    const lior = await mk(me.id, 'Lior Plain')
    await setConnectionTags(me.id, lior, ['Investor', 'Follow up'])
    await addNote(me.id, lior, 'Discussed medical AI partnership')
    const theirs = await mk(other.id, 'Hidden Match')
    await addNote(other.id, theirs, 'medical AI secret')

    const names = async (q: string, tag?: string) => (await listConnections(me.id, q, { tag })).map((c) => c.name)
    expect(await names('Cedar')).toEqual(['Dana Investor'])
    expect(await names('Carmel')).toEqual(['Dana Investor'])
    expect(await names('investor')).toEqual(expect.arrayContaining(['Dana Investor', 'Lior Plain']))
    expect(await names('', 'Investor')).toEqual(['Lior Plain'])
    expect(await names('medical AI')).toEqual(['Lior Plain'])
    expect(await names('secret')).toEqual([])
    void dana
  })

  it('tags are validated and only the owner can change them', async () => {
    const me = await withCard('Tagger')
    const stranger = await withCard('Stranger Tagger')
    const d = await db()
    await d.query(`INSERT INTO connections (id, owner_user_id, name, source) VALUES ('con_tagtest01', $1, 'Tagged', 'manual')`, [me.id])
    expect(await setConnectionTags(me.id, 'con_tagtest01', [' Investor ', 'Investor', 'Friend'])).toEqual(['Investor', 'Friend'])
    await expect(setConnectionTags(me.id, 'con_tagtest01', ['x'.repeat(30)])).rejects.toThrow('24 characters')
    await expect(setConnectionTags(stranger.id, 'con_tagtest01', ['Mine'])).rejects.toThrow()
  })

  it('timeline: met, my notes and reminders, and member views of my cards (disclosed to them) — newest first', async () => {
    const me = await withCard('Timeline Owner')
    const them = await withCard('Timeline Member')
    const d = await db()
    await d.query(`INSERT INTO connections (id, owner_user_id, contact_user_id, name, source, met_where, met_at) VALUES ('con_tl_0001', $1, $2, 'Timeline Member', 'nearby', 'Harbor', now() - interval '2 days')`, [me.id, them.id])
    await addNote(me.id, 'con_tl_0001', 'Send the deck')
    await addFollowUp(me.id, 'con_tl_0001', { title: 'Email them', dueOn: '2026-10-10' })
    const share = await startShare(me.id, { capsuleId: me.capsuleId })
    const r = await resolveShare(share.token, { record: true, claimToken: 'x' })
    if (r.status !== 'ok') throw new Error('share')
    await recordMemberView({ capsuleId: me.capsuleId, ownerId: me.id, viewerId: them.id, shareSessionId: r.session.id, expanded: false })
    const { timeline } = await getConnection(me.id, 'con_tl_0001')
    expect(timeline.map((t) => t.kind)).toEqual(expect.arrayContaining(['met', 'note', 'followup', 'viewed_card']))
    expect(timeline.at(-1)!.kind).toBe('met')
  })
})

describe('Today intelligence never invents insight', () => {
  it('top card and top source appear only with at least 2 connections behind them; quiet contacts are listed', async () => {
    const me = await withCard('Intel Owner', 'Conference')
    const d = await db()
    const s0 = await relationshipSummary(me.id)
    expect(s0.topCards).toEqual([])
    expect(s0.topChannel).toBeNull()
    for (const n of ['One', 'Two']) await d.query(`INSERT INTO connections (id, owner_user_id, name, source, my_capsule_id, channel) VALUES ($1,$2,$3,'nearby',$4,'nearby')`, [`con_intel_${n}`, me.id, `Person ${n}`, me.capsuleId])
    const s = await relationshipSummary(me.id)
    expect(s.topCards[0]).toMatchObject({ name: 'Conference', n: 2 })
    expect(s.topChannel).toEqual({ label: 'Nearby', n: 2 })
    expect(s.week.connections).toBe(2)
    expect(s.quiet.map((q) => q.name)).toEqual(expect.arrayContaining(['Person One', 'Person Two']))
    await addNote(me.id, 'con_intel_One', 'noted')
    expect((await relationshipSummary(me.id)).quiet.map((q) => q.name)).toEqual(['Person Two'])
  })
})

describe('Wallet link and card back', () => {
  it('the permanent Wallet link follows the active card, so a pass never needs reissuing', async () => {
    const me = await withCard('Wallet Follower', 'Work', 'Work Name')
    const personal = await createCapsule(me.id, { name: 'Personal', mode: 'personal', display_name: 'Personal Name', fields: fields() })
    const link = await walletLink(me.id)
    const token = link.url.split('/c/')[1]
    const v1 = await resolveShare(token)
    expect(v1.status === 'ok' && v1.view.displayName).toBe('Work Name')
    await setDefaultCapsule(me.id, personal)
    const v2 = await resolveShare(token)
    expect(v2.status === 'ok' && v2.view.displayName).toBe('Personal Name')
    expect((await walletLink(me.id)).shareId).toBe(link.shareId)
  })

  it('the card back shows only first-layer details', async () => {
    const me = await withCard('Back Owner')
    const { capsule } = await getCapsule(me.id, me.capsuleId)
    const values = cardFor(capsule).details.map((d) => d.value)
    expect(values).toContain('me@example.com')
    expect(values).not.toContain('example.com') // learn-more layer
    expect(values).not.toContain('+1 555 010 9999') // hidden
  })
})

describe('analytics payloads carry ids and enums only', () => {
  it('drops names, emails, free text and unknown keys', () => {
    expect(cleanProps({ card_id: 'cap_abc123', channel: 'nearby', email: 'a@b.c', name: 'Dana', note: 'secret', count: 3, connection_id: 'Dana Cohen', surface: 'share' }))
      .toEqual({ card_id: 'cap_abc123', channel: 'nearby', count: 3, surface: 'share' })
  })
})
