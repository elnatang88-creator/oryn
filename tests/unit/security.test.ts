import { describe, expect, it } from 'vitest'
import { makeUser, fields, db } from './helpers'
import { createCapsule, getCapsule, updateCapsule } from '@/lib/server/services/capsules'
import { startShare, revokeShare, resolveShare, getShareForOwner } from '@/lib/server/services/sharing'
import { getConnection, addNote } from '@/lib/server/services/connections'
import { createOrg, addMember, getOrg, changeRole, removeMember } from '@/lib/server/services/orgs'
import { createEvent, getEvent, addParticipant, listParticipants, setEventStatus } from '@/lib/server/services/events'
import { createStation, listStations, reassignStation, resolveDestination, setStationActive } from '@/lib/server/services/stations'
import { signIn, userForSessionToken, changePassword } from '@/lib/server/services/auth'
import { adminOverview } from '@/lib/server/services/admin'
import { requestDeletion, executeDeletion, requestExport, buildExport } from '@/lib/server/services/privacy'
import { AppError } from '@/lib/server/errors'

const code = async (p: Promise<unknown>) => {
  try { await p; return 'ok' } catch (e) { return e instanceof AppError ? e.code : 'crash' }
}

describe('ownership and tenant isolation', () => {
  it('users cannot read, edit or revoke other users’ capsules and shares', async () => {
    const a = await makeUser('pro')
    const b = await makeUser('pro')
    const capsuleId = await createCapsule(a.id, { name: 'Mine', mode: 'professional', display_name: 'A', fields: fields() })
    const share = await startShare(a.id, { capsuleId })
    expect(await code(getCapsule(b.id, capsuleId))).toBe('not_found')
    expect(await code(updateCapsule(b.id, capsuleId, { name: 'x', mode: 'custom', display_name: 'x' }))).toBe('not_found')
    expect(await code(startShare(b.id, { capsuleId }))).toBe('not_found')
    expect(await code(getShareForOwner(b.id, share.id))).toBe('not_found')
    expect(await code(revokeShare(b.id, share.id))).toBe('not_found')
    expect((await resolveShare(share.token)).status).toBe('ok')
  })

  it('connections, notes and follow-ups are private to their owner', async () => {
    const a = await makeUser('pro')
    const b = await makeUser('pro')
    const [row] = await (await db()).query<{ id: string }>(`INSERT INTO connections (id, owner_user_id, name, source) VALUES ('con_iso', $1, 'Sam', 'manual') RETURNING id`, [a.id])
    expect(await code(getConnection(b.id, row.id))).toBe('not_found')
    expect(await code(addNote(b.id, row.id, 'sneaky'))).toBe('not_found')
  })

  it('workspaces are isolated: non-members get not_found, roles are enforced server-side', async () => {
    const owner = await makeUser('business')
    const outsider = await makeUser('business')
    const member = await makeUser('free')
    const orgA = await createOrg(owner.id, 'Org A')
    const orgB = await createOrg(outsider.id, 'Org B')
    const eventA = await createEvent(owner.id, orgA, { name: 'Summit A' })

    expect(await code(getOrg(outsider.id, orgA))).toBe('not_found')
    expect(await code(getEvent(outsider.id, eventA))).toBe('not_found')
    expect(await code(listParticipants(outsider.id, eventA))).toBe('not_found')
    expect(await code(createEvent(outsider.id, orgA, { name: 'Hijack' }))).toBe('not_found')
    expect(await code(listStations(outsider.id, orgA))).toBe('not_found')

    await addMember(owner.id, orgA, { email: member.email, role: 'member' })
    expect(await code(getEvent(member.id, eventA))).toBe('ok')
    expect(await code(createEvent(member.id, orgA, { name: 'Nope' }))).toBe('forbidden')
    expect(await code(addParticipant(member.id, eventA, { email: 'x@example.com', displayName: 'X' }))).toBe('forbidden')
    expect(await code(addMember(member.id, orgA, { email: outsider.email, role: 'admin' }))).toBe('forbidden')
    expect(await code(changeRole(member.id, orgA, member.id, 'admin'))).toBe('forbidden')
    expect(await code(getOrg(member.id, orgB))).toBe('not_found')

    await changeRole(owner.id, orgA, member.id, 'manager')
    expect(await code(createEvent(member.id, orgA, { name: 'Managed' }))).toBe('ok')
    await removeMember(owner.id, orgA, member.id)
    expect(await code(getEvent(member.id, eventA))).toBe('not_found')

    const log = await (await db()).query<{ action: string }>(`SELECT action FROM audit_events WHERE org_id = $1`, [orgA])
    expect(log.map((l) => l.action)).toEqual(expect.arrayContaining(['org.created', 'org.member_added', 'org.role_changed', 'org.member_removed', 'event.created']))
  })

  it('event rules apply to live shares, and ending the event closes them', async () => {
    const owner = await makeUser('business')
    const org = await createOrg(owner.id, 'Events Co')
    const eventId = await createEvent(owner.id, org, { name: 'Expo', allowPhone: false })
    await setEventStatus(owner.id, eventId, 'live')
    const capsuleId = await createCapsule(owner.id, { name: 'Expo', mode: 'event', display_name: 'O', fields: fields().map((f) => ({ ...f, layer: 'instant' as const })) })
    const share = await startShare(owner.id, { capsuleId, scope: 'event', eventId })
    const r = await resolveShare(share.token)
    if (r.status !== 'ok') throw new Error('ok expected')
    expect(r.view.eventName).toBe('Expo')
    expect(r.view.fields.some((f) => f.kind === 'phone')).toBe(false)
    await setEventStatus(owner.id, eventId, 'ended')
    expect((await resolveShare(share.token)).status).toBe('expired')
  })

  it('stations: a printed code survives reassignment and can be paused', async () => {
    const owner = await makeUser('business')
    const org = await createOrg(owner.id, 'Booth Co')
    const c1 = await createCapsule(owner.id, { name: 'Sales', mode: 'business', display_name: 'Sales team', fields: fields() })
    const c2 = await createCapsule(owner.id, { name: 'Hiring', mode: 'hiring', display_name: 'We’re hiring', fields: fields() })
    const { stationId, code: qr } = await createStation(owner.id, org, { name: 'Booth 1', kind: 'booth', capsuleId: c1 })
    const d1 = await resolveDestination(qr)
    if (d1.status !== 'ok') throw new Error('ok expected')
    const v1 = await resolveShare(d1.token)
    expect(v1.status === 'ok' && v1.view.displayName).toBe('Sales team')
    await reassignStation(owner.id, stationId, c2)
    const v2 = await resolveShare(d1.token)
    expect(v2.status === 'ok' && v2.view.displayName).toBe('We’re hiring')
    await setStationActive(owner.id, stationId, false)
    expect((await resolveDestination(qr)).status).toBe('paused')
    expect((await resolveDestination('not-a-code!')).status).toBe('not_found')
  })

  it('platform admin console is hidden from normal users', async () => {
    const u = await makeUser('business')
    expect(await code(adminOverview(u.id))).toBe('not_found')
  })
})

describe('authentication', () => {
  it('rejects wrong passwords, supports session revocation on password change', async () => {
    const u = await makeUser('free')
    expect(await code(signIn({ email: u.email, password: 'wrong password!' }, { userAgent: 't', deviceId: null, ipKey: 'auth1' }))).toBe('invalid')
    const s2 = await signIn({ email: u.email, password: 'correct horse battery' }, { userAgent: 't', deviceId: null, ipKey: 'auth1' })
    const me = await userForSessionToken(u.token)
    expect(me?.id).toBe(u.id)
    await changePassword(u.id, me!.session_id, 'correct horse battery', 'a brand new password')
    expect(await userForSessionToken(s2.token)).toBeNull() // other session revoked
    expect((await userForSessionToken(u.token))?.id).toBe(u.id)
    expect(await userForSessionToken('garbage')).toBeNull()
  })

  it('rate-limits repeated sign-in attempts per account', async () => {
    const u = await makeUser('free')
    const results: string[] = []
    for (let i = 0; i < 10; i++) results.push(await code(signIn({ email: u.email, password: 'nope nope nope' }, { userAgent: 't', deviceId: null, ipKey: `rl-${i}` })))
    expect(results).toContain('rate_limited')
  })

  it('stores only hashes of session tokens and passwords', async () => {
    const u = await makeUser('free')
    const rows = await (await db()).query<{ token_hash: string }>(`SELECT token_hash FROM sessions WHERE user_id = $1`, [u.id])
    expect(rows.every((r) => r.token_hash !== u.token)).toBe(true)
    const [p] = await (await db()).query<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [u.id])
    expect(p.password_hash.startsWith('scrypt$')).toBe(true)
  })
})

describe('data lifecycle', () => {
  it('export contains the account’s data; deletion closes shares at once and erases after the grace period', async () => {
    const u = await makeUser('pro')
    const capsuleId = await createCapsule(u.id, { name: 'Mine', mode: 'professional', display_name: 'Me', fields: fields(), private_note: 'my note' })
    const share = await startShare(u.id, { capsuleId })
    const exportId = await requestExport(u.id)
    await buildExport(await db(), exportId, u.id)
    const [e] = await (await db()).query<{ payload: { capsules: { private_note: string }[] } }>(`SELECT payload FROM data_exports WHERE id = $1`, [exportId])
    expect(e.payload.capsules[0].private_note).toBe('my note')

    expect(await code(requestDeletion(u.id, 'wrong password'))).toBe('invalid')
    await requestDeletion(u.id, 'correct horse battery')
    expect((await resolveShare(share.token)).status).toBe('revoked')
    await (await db()).query(`UPDATE deletion_requests SET scheduled_for = now() WHERE user_id = $1`, [u.id])
    const [req] = await (await db()).query<{ id: string }>(`SELECT id FROM deletion_requests WHERE user_id = $1`, [u.id])
    await executeDeletion(await db(), req.id, u.id)
    const left = await (await db()).query(`SELECT 1 FROM capsules WHERE owner_user_id = $1 UNION ALL SELECT 1 FROM users WHERE id = $1`, [u.id])
    expect(left).toHaveLength(0)
    expect((await resolveShare(share.token)).status).toBe('not_found')
    const audit = await (await db()).query(`SELECT 1 FROM audit_events WHERE actor_user_id = $1`, [u.id])
    expect(audit).toHaveLength(0)
  })
})

describe('audit trail', () => {
  it('records sensitive actions without storing private content', async () => {
    const { createCapsule: cc, setDefaultCapsule } = await import('@/lib/server/services/capsules')
    const { startShare: ss, requestConnection, setShareContext } = await import('@/lib/server/services/sharing')
    const conn = await import('@/lib/server/services/connections')
    const u = await makeUser('pro', 'Auditee')
    const capsuleId = await cc(u.id, { name: 'A', mode: 'professional', display_name: 'A', fields: fields(), private_note: 'SECRET-CAPSULE-NOTE' })
    await setDefaultCapsule(u.id, capsuleId)
    const share = await ss(u.id, { capsuleId })
    await setShareContext(u.id, share.id, 'SECRET-PLACE')
    await requestConnection(share.token, { name: 'SECRET-NAME', contact: 'secret-contact@example.com', message: 'SECRET-MESSAGE' }, { claimToken: null, ipKey: 'audit1' })
    const [req] = await conn.listRequests(u.id)
    const { connectionId } = await conn.respondToRequest(u.id, req.id, true)
    await conn.addNote(u.id, connectionId!, 'SECRET-NOTE-BODY')
    const fu = await conn.addFollowUp(u.id, connectionId!, { title: 'SECRET-FOLLOWUP', dueOn: '2026-10-10' })
    await conn.setFollowUpDone(u.id, fu, true)
    await conn.updateConnectionContext(u.id, connectionId!, 'SECRET-MET-WHERE')

    const rows = await (await db()).query<{ action: string; meta: unknown }>(`SELECT action, meta FROM audit_events WHERE actor_user_id = $1 OR target_id = ANY($2)`, [u.id, [req.id]])
    const actions = rows.map((r) => r.action)
    expect(actions).toEqual(expect.arrayContaining(['user.created', 'session.created', 'capsule.created', 'capsule.default_changed', 'share.started', 'share.context_updated', 'connection_request.received', 'connection_request.accepted', 'note.added', 'followup.created', 'followup.completed', 'connection.context_updated']))
    const everything = JSON.stringify(await (await db()).query(`SELECT * FROM audit_events`))
    for (const secret of ['SECRET-CAPSULE-NOTE', 'SECRET-PLACE', 'SECRET-NAME', 'secret-contact@example.com', 'SECRET-MESSAGE', 'SECRET-NOTE-BODY', 'SECRET-FOLLOWUP', 'SECRET-MET-WHERE', 'correct horse battery']) {
      expect(everything).not.toContain(secret)
    }
    // Passwords and session tokens never appear in any table in the clear.
    const sessions = JSON.stringify(await (await db()).query(`SELECT * FROM sessions WHERE user_id = $1`, [u.id]))
    expect(sessions).not.toContain(u.token)
  })
})
