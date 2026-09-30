import { describe, expect, it } from 'vitest'
import { makeUser, fields, db, PASSWORD } from './helpers'
import { signIn, userForSessionToken } from '@/lib/server/services/auth'
import { addMember } from '@/lib/server/services/orgs'
import { requestConnection, listShares } from '@/lib/server/services/sharing'
import { listRequests, respondToRequest, addNote, addFollowUp, keepCapsule, getConnection } from '@/lib/server/services/connections'
import { requestExport, downloadExport } from '@/lib/server/services/privacy'
import { buildExport } from '@/lib/server/services/privacy'
import { createCapsule } from '@/lib/server/services/capsules'
import { startShare, resolveShare } from '@/lib/server/services/sharing'
import { createOrg } from '@/lib/server/services/orgs'
import { createEvent, addParticipant, setEventStatus } from '@/lib/server/services/events'
import { requestDeletion, executeDeletion } from '@/lib/server/services/privacy'

/** Reproductions of the account-deletion defects found in QA (see docs/SECURITY_TEST_REPORT.md). */
describe('account deletion must never touch another user or tenant', () => {
  it('REPRO-1: deleting an org owner does not delete another user’s event share', async () => {
    const owner = await makeUser('business', 'Owner')
    const guest = await makeUser('pro', 'Guest')
    const org = await createOrg(owner.id, 'Solo Org')
    const eventId = await createEvent(owner.id, org, { name: 'Expo' })
    await setEventStatus(owner.id, eventId, 'live')
    await addParticipant(owner.id, eventId, { email: guest.email, displayName: 'Guest' })
    const guestCapsule = await createCapsule(guest.id, { name: 'G', mode: 'event', display_name: 'Guest', fields: fields() })
    const guestShare = await startShare(guest.id, { capsuleId: guestCapsule, scope: 'event', eventId })

    await requestDeletion(owner.id, PASSWORD)
    await (await db()).query(`UPDATE deletion_requests SET scheduled_for = now() WHERE user_id = $1`, [owner.id])
    const [req] = await (await db()).query<{ id: string }>(`SELECT id FROM deletion_requests WHERE user_id = $1`, [owner.id])
    await executeDeletion(await db(), req.id, owner.id)
    expect(await (await db()).query(`SELECT 1 FROM users WHERE id = $1`, [owner.id])).toHaveLength(0)

    const rows = await (await db()).query(`SELECT 1 FROM share_sessions WHERE id = $1`, [guestShare.id])
    expect(rows).toHaveLength(1) // the guest's share record is the guest's data
    const caps = await (await db()).query(`SELECT 1 FROM capsules WHERE id = $1`, [guestCapsule])
    expect(caps).toHaveLength(1)
    // It no longer opens (the event is gone), but it was not silently destroyed.
    expect((await resolveShare(guestShare.token)).status).not.toBe('ok')
  })

  it('REPRO-2: a deletion request for user A can never delete user B', async () => {
    const a = await makeUser('free', 'A')
    const b = await makeUser('free', 'B')
    await (await db()).query(`INSERT INTO deletion_requests (id, user_id, scheduled_for) VALUES ('del_repro2', $1, now())`, [a.id])
    await executeDeletion(await db(), 'del_repro2', b.id) // mismatched payload
    const left = await (await db()).query(`SELECT id FROM users WHERE id = ANY($1)`, [[a.id, b.id]])
    expect(left.map((r) => r.id as string).sort()).toEqual([a.id, b.id].sort())
  })

  it('REPRO-3: requesting deletion requires re-authentication, not just knowing the email', async () => {
    const a = await makeUser('free', 'A')
    await expect(requestDeletion(a.id, a.email)).rejects.toThrow(/password/) // email alone is not enough
    await expect(requestDeletion(a.id, '')).rejects.toThrow()
    const pending = await (await db()).query(`SELECT 1 FROM deletion_requests WHERE user_id = $1`, [a.id])
    expect(pending).toHaveLength(0)
  })
})

describe('account deletion removes or de-identifies everything the person owns', () => {
  it('erases capsules, shares, connections, notes, follow-ups, events, devices, sessions and analytics ids — and nothing of anyone else', async () => {
    const d = await db()
    const me = await makeUser('business', 'Leaving Person')
    const colleague = await makeUser('business', 'Colleague')
    const stranger = await makeUser('pro', 'Stranger')

    // What "me" owns.
    const cap = await createCapsule(me.id, { name: 'Mine', mode: 'professional', display_name: 'Leaving Person', fields: fields(), private_note: 'PRIVATE-leaving' })
    const share = await startShare(me.id, { capsuleId: cap })
    await requestConnection(share.token, { name: 'Stranger', contact: 'stranger-contact', message: 'hi' }, { claimToken: null, ipKey: 'del-a' })
    const [req] = await listRequests(me.id)
    const { connectionId } = await respondToRequest(me.id, req.id, true)
    await addNote(me.id, connectionId!, 'NOTE-leaving')
    await addFollowUp(me.id, connectionId!, { title: 'FU-leaving', dueOn: '2026-10-10' })
    const exportId = await requestExport(me.id)
    await buildExport(d, exportId, me.id)
    const soloOrg = await createOrg(me.id, 'Solo')
    await createEvent(me.id, soloOrg, { name: 'Solo event' })
    const sharedOrg = await createOrg(me.id, 'Shared')
    await addMember(me.id, sharedOrg, { email: colleague.email, role: 'admin' })
    const sharedEvent = await createEvent(me.id, sharedOrg, { name: 'Shared event' })
    const colleagueOrg = await createOrg(colleague.id, 'Colleague Org')
    const colleagueEvent = await createEvent(colleague.id, colleagueOrg, { name: 'Their event' })
    await addParticipant(colleague.id, colleagueEvent, { email: me.email, displayName: 'Leaving Person' })

    // What other people own, including a copy the stranger chose to keep.
    const strangerCap = await createCapsule(stranger.id, { name: 'S', mode: 'professional', display_name: 'Stranger', fields: fields() })
    const strangerShare = await startShare(stranger.id, { capsuleId: strangerCap })
    const kept = await keepCapsule(stranger.id, share.token, null)

    await requestDeletion(me.id, PASSWORD)
    // Grace period passes.
    await d.query(`UPDATE deletion_requests SET scheduled_for = now() - interval '1 second' WHERE user_id = $1`, [me.id])
    const [delReq] = await d.query<{ id: string }>(`SELECT id FROM deletion_requests WHERE user_id = $1`, [me.id])
    await executeDeletion(d, delReq.id, me.id)

    // 1. No row anywhere still carries the person's id or account email.
    const tables = (await d.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`)).map((r) => r.tablename)
    for (const table of tables) {
      const hits = await d.query(`SELECT 1 FROM ${table} t WHERE row_to_json(t)::text LIKE '%' || $1 || '%' OR row_to_json(t)::text ILIKE '%' || $2 || '%'`, [me.id, me.email])
      expect({ table, hits: hits.length }).toEqual({ table, hits: 0 })
    }
    for (const secret of ['PRIVATE-leaving', 'NOTE-leaving', 'FU-leaving']) {
      for (const table of tables) {
        const hits = await d.query(`SELECT 1 FROM ${table} t WHERE row_to_json(t)::text LIKE '%' || $1 || '%'`, [secret])
        expect({ table, secret, hits: hits.length }).toEqual({ table, secret, hits: 0 })
      }
    }
    expect(await d.query(`SELECT 1 FROM organizations WHERE id = $1`, [soloOrg])).toHaveLength(0)

    // 2. Nobody else lost anything.
    expect(await d.query(`SELECT 1 FROM users WHERE id = ANY($1)`, [[colleague.id, stranger.id]])).toHaveLength(2)
    const [shared] = await d.query<{ created_by: string }>(`SELECT created_by FROM organizations WHERE id = $1`, [sharedOrg])
    expect(shared.created_by).toBe(colleague.id) // handed over, not deleted
    expect(await d.query(`SELECT 1 FROM memberships WHERE org_id = $1 AND user_id = $2 AND role = 'owner'`, [sharedOrg, colleague.id])).toHaveLength(1)
    expect(await d.query(`SELECT 1 FROM events WHERE id = ANY($1)`, [[sharedEvent, colleagueEvent]])).toHaveLength(2)
    expect((await resolveShare(strangerShare.token)).status).toBe('ok')
    expect((await getConnection(stranger.id, kept)).connection.name).toBe('Leaving Person') // the stranger's own saved copy
    const [participant] = await d.query<{ display_name: string; status: string }>(`SELECT display_name, status FROM event_participants WHERE event_id = $1`, [colleagueEvent])
    expect(participant).toEqual({ display_name: 'Deleted account', status: 'removed' })
    expect(await d.query(`SELECT 1 FROM audit_events WHERE action = 'account.deleted'`)).not.toHaveLength(0)
  })

  it('after deletion the person can no longer read anything', async () => {
    const d = await db()
    const me = await makeUser('pro', 'Gone')
    const cap = await createCapsule(me.id, { name: 'Mine', mode: 'professional', display_name: 'Gone', fields: fields() })
    const share = await startShare(me.id, { capsuleId: cap })
    const exportId = await requestExport(me.id)
    await buildExport(d, exportId, me.id)
    await requestDeletion(me.id, PASSWORD)
    // Immediately: every share is closed.
    expect((await resolveShare(share.token)).status).toBe('revoked')
    await d.query(`UPDATE deletion_requests SET scheduled_for = now() WHERE user_id = $1`, [me.id])
    const [delReq] = await d.query<{ id: string }>(`SELECT id FROM deletion_requests WHERE user_id = $1`, [me.id])
    await executeDeletion(d, delReq.id, me.id)
    expect(await userForSessionToken(me.token)).toBeNull()
    await expect(signIn({ email: me.email, password: PASSWORD }, { userAgent: 't', deviceId: null, ipKey: 'gone' })).rejects.toThrow()
    expect((await resolveShare(share.token)).status).toBe('not_found')
    await expect(downloadExport(me.id, exportId)).rejects.toThrow()
    expect(await listShares(me.id)).toHaveLength(0)
  })

  it('a user can’t delete another user: wrong password, wrong request, or before the grace period', async () => {
    const d = await db()
    const a = await makeUser('free', 'A')
    const b = await makeUser('free', 'B')
    await expect(requestDeletion(b.id, 'not-b-password')).rejects.toThrow()
    await requestDeletion(a.id, PASSWORD)
    const [aReq] = await d.query<{ id: string }>(`SELECT id FROM deletion_requests WHERE user_id = $1`, [a.id])
    await executeDeletion(d, aReq.id, b.id) // A's request, B's id
    await executeDeletion(d, aReq.id, a.id) // grace period not over yet
    expect(await d.query(`SELECT 1 FROM users WHERE id = ANY($1)`, [[a.id, b.id]])).toHaveLength(2)
    const audit = await d.query(`SELECT 1 FROM audit_events WHERE action = 'account.deletion_reauth_failed' AND actor_user_id = $1`, [b.id])
    expect(audit).toHaveLength(1)
  })
})
