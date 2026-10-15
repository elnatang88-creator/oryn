import { describe, expect, it } from 'vitest'
import { makeUser, fields, db } from './helpers'
import { createCapsule, updateCapsule, getCapsule, updatePolicy } from '@/lib/server/services/capsules'
import { startShare, resolveShare, revokeShare, requestConnection, recipientVcard, quickShare } from '@/lib/server/services/sharing'
import { listRequests, respondToRequest, addNote, addFollowUp, getConnection, keepCapsule, setFollowUpDone } from '@/lib/server/services/connections'
import { todaySummary } from '@/lib/server/services/today'

const SECRET_NOTE = 'PRIVATE-NOTE-never-leaves-the-owner'

/** The first demo, end to end, against the real schema. */
describe('core flow: capsule → share → recipient → workspace → revoke', () => {
  it('runs the full founder demo', async () => {
    const sender = await makeUser('pro', 'Noa Adler')
    // 1–2. Create a capsule and choose visible fields.
    const capsuleId = await createCapsule(sender.id, { name: 'Conference', mode: 'professional', display_name: 'Noa Adler', headline: 'Product lead', fields: fields(), primary_action: { fieldId: 'f_mail01' }, private_note: SECRET_NOTE })
    // 3. Activate.
    const share = await startShare(sender.id, { capsuleId, channel: 'qr', contextLabel: 'Hall B' })
    expect(share.url).toContain(`/c/${share.token}`)

    // 4–5. Recipient sees only the Instant layer — no account.
    const instant = await resolveShare(share.token, { record: true, claimToken: 'browser-1' })
    expect(instant.status).toBe('ok')
    if (instant.status !== 'ok') return
    expect(instant.view.fields.map((f) => f.label)).toEqual(['Role', 'Email'])
    expect(instant.view.hasMore).toBe(true)
    expect(instant.view.contextLabel).toBeNull() // owner's "Hall B" stays private
    const serialized = JSON.stringify(instant.view)
    expect(serialized).not.toContain(SECRET_NOTE)
    expect(serialized).not.toContain('+1 555 010 9999')
    expect(serialized).not.toContain('Hall B')

    // 6. Learn more reveals the expanded layer, still not hidden fields.
    const expanded = await resolveShare(share.token, { layer: 'expanded', record: true, claimToken: 'browser-1' })
    if (expanded.status !== 'ok') throw new Error('expected ok')
    expect(expanded.view.fields.map((f) => f.label)).toEqual(['Role', 'Email', 'Website'])
    expect(JSON.stringify(expanded.view)).not.toContain(SECRET_NOTE)
    expect(JSON.stringify(expanded.view)).not.toContain('555 010 9999')

    // Save to phone: vCard contains only permitted fields.
    const vcard = await recipientVcard(share.token, 'browser-1')
    if (vcard.status !== 'ok') throw new Error('vcard')
    expect(vcard.vcard).toContain('EMAIL;TYPE=INTERNET:me@example.com')
    expect(vcard.vcard).not.toContain('555')
    expect(vcard.vcard).not.toContain(SECRET_NOTE)

    // 7. Recipient asks to connect (their choice to identify).
    await requestConnection(share.token, { name: 'Sam Rivera', contact: 'sam@example.com', message: 'Loved the talk' }, { claimToken: 'browser-1', ipKey: 'r1' })

    // 8. Sender sees it in the workspace.
    const today = await todaySummary(sender.id)
    expect(today.pending.map((p) => p.from_name)).toContain('Sam Rivera')
    expect(today.counts.opened).toBe(1)
    expect(today.counts.expanded).toBe(1)
    const [req] = await listRequests(sender.id)
    const { connectionId } = await respondToRequest(sender.id, req.id, true)
    expect(connectionId).toBeTruthy()

    // 9–10. Private note and follow-up.
    await addNote(sender.id, connectionId!, 'Send the onboarding deck')
    const fu = await addFollowUp(sender.id, connectionId!, { title: 'Email Sam', dueOn: '2026-10-02' })
    await setFollowUpDone(sender.id, fu, true)
    const detail = await getConnection(sender.id, connectionId!)
    expect(detail.connection.met_where).toBe('Hall B')
    expect(detail.notes.map((n) => n.body)).toContain('Send the onboarding deck')
    expect(detail.notes.some((n) => n.body.includes('Loved the talk'))).toBe(true)

    // 11a. Edit: the recipient sees the live version immediately.
    const { capsule } = await getCapsule(sender.id, capsuleId)
    await updateCapsule(sender.id, capsuleId, { ...capsule, accent: 'blue', primary_action: null, fields: capsule.fields.map((f) => (f.kind === 'email' ? { ...f, layer: 'hidden' as const } : f)) })
    const afterEdit = await resolveShare(share.token, { claimToken: 'browser-1' })
    if (afterEdit.status !== 'ok') throw new Error('expected ok')
    expect(afterEdit.view.fields.map((f) => f.label)).toEqual(['Role'])

    // 11b–12. Revoke: the recipient can no longer access anything.
    await revokeShare(sender.id, share.id)
    expect((await resolveShare(share.token, { claimToken: 'browser-1' })).status).toBe('revoked')
    expect((await resolveShare(share.token, { layer: 'expanded', claimToken: 'browser-1' })).status).toBe('revoked')
    expect((await recipientVcard(share.token, 'browser-1')).status).toBe('revoked')
    await expect(requestConnection(share.token, { name: 'X', contact: 'x@example.com' }, { claimToken: 'browser-1', ipKey: 'r2' })).rejects.toThrow()

    // Audit trail recorded the important steps.
    const actions = (await (await db()).query<{ action: string }>(`SELECT action FROM audit_events WHERE actor_user_id = $1`, [sender.id])).map((a) => a.action)
    expect(actions).toEqual(expect.arrayContaining(['capsule.created', 'share.started', 'connection_request.accepted', 'capsule.updated', 'share.revoked']))
  })

  it('one-time capsules open for the first browser only, and never on a passive load', async () => {
    const sender = await makeUser('pro')
    const capsuleId = await createCapsule(sender.id, { name: 'Store', mode: 'personal', display_name: 'Noa', fields: fields() })
    const share = await startShare(sender.id, { capsuleId, oneTime: true })
    // A link preview (no record) must not reveal or consume it.
    expect((await resolveShare(share.token, { claimToken: 'preview-bot' })).status).toBe('needs_open')
    expect((await resolveShare(share.token, { claimToken: 'first', record: true })).status).toBe('ok')
    expect((await resolveShare(share.token, { claimToken: 'first', record: true })).status).toBe('ok')
    expect((await resolveShare(share.token, { claimToken: 'second', record: true })).status).toBe('claimed')
    expect((await resolveShare(share.token, { claimToken: null, record: true })).status).toBe('claimed')
  })

  it('expired shares are refused', async () => {
    const sender = await makeUser('pro')
    const capsuleId = await createCapsule(sender.id, { name: 'Short', mode: 'social', display_name: 'Noa', fields: fields() })
    const share = await startShare(sender.id, { capsuleId, durationMinutes: 5 })
    expect((await resolveShare(share.token)).status).toBe('ok')
    await (await db()).query(`UPDATE share_sessions SET expires_at = now() - interval '1 minute' WHERE id = $1`, [share.id])
    expect((await resolveShare(share.token)).status).toBe('expired')
  })

  it('tampered or forged tokens are rejected before any lookup', async () => {
    const sender = await makeUser('pro')
    const capsuleId = await createCapsule(sender.id, { name: 'A', mode: 'professional', display_name: 'A', fields: fields() })
    const share = await startShare(sender.id, { capsuleId })
    const [sid, exp, sig] = share.token.split('.')
    expect((await resolveShare(`${sid}.${exp}.${sig.slice(0, -2)}AA`)).status).toBe('not_found')
    expect((await resolveShare(`${sid}.zzzz.${sig}`)).status).toBe('not_found') // extending expiry breaks the signature
    expect((await resolveShare('s_aaaaaaaaaaaaaaaaaaaa.0.bbbbbbbbbbbbbbbbbbbbbb')).status).toBe('not_found')
    expect((await resolveShare('../../etc/passwd')).status).toBe('not_found')
  })

  it('view-only capsules cannot be saved or used to send requests', async () => {
    const sender = await makeUser('pro')
    const capsuleId = await createCapsule(sender.id, { name: 'View', mode: 'professional', display_name: 'V', fields: fields() })
    await updatePolicy(sender.id, capsuleId, { duration_minutes: null, one_time: false, interaction_level: 'view', allow_expanded: false })
    const share = await startShare(sender.id, { capsuleId })
    const r = await resolveShare(share.token, { layer: 'expanded' })
    if (r.status !== 'ok') throw new Error('ok expected')
    expect(r.view.canSave).toBe(false)
    expect(r.view.canConnect).toBe(false)
    expect(r.view.fields.map((f) => f.label)).toEqual(['Role', 'Email']) // "Learn more" disabled by policy
    expect((await recipientVcard(share.token, null)).status).toBe('restricted')
    await expect(requestConnection(share.token, { name: 'X', contact: 'x@example.com' }, { claimToken: null, ipKey: 'z' })).rejects.toThrow(/doesn’t accept/)
  })

  it('declining a request is silent and creates nothing', async () => {
    const sender = await makeUser('pro')
    const capsuleId = await createCapsule(sender.id, { name: 'C', mode: 'professional', display_name: 'C', fields: fields() })
    const share = await startShare(sender.id, { capsuleId })
    await requestConnection(share.token, { name: 'Pat', contact: 'pat@example.com' }, { claimToken: null, ipKey: 'd1' })
    const [req] = await listRequests(sender.id)
    const r = await respondToRequest(sender.id, req.id, false)
    expect(r.connectionId).toBeNull()
    expect(await listRequests(sender.id)).toHaveLength(0)
  })

  it('keeping a capsule lands in the recipient’s own workspace; the sender only gets a count', async () => {
    const sender = await makeUser('pro', 'Noa Adler')
    const recipient = await makeUser('free', 'Sam')
    const capsuleId = await createCapsule(sender.id, { name: 'C', mode: 'professional', display_name: 'Noa Adler', fields: fields(), private_note: SECRET_NOTE })
    const share = await startShare(sender.id, { capsuleId })
    const conId = await keepCapsule(recipient.id, share.token, null)
    const kept = await getConnection(recipient.id, conId)
    expect(kept.connection.name).toBe('Noa Adler')
    expect(JSON.stringify(kept)).not.toContain(SECRET_NOTE)
    expect(JSON.stringify(kept)).not.toContain('555 010 9999')
    const [s] = await (await db()).query<{ saved_count: number }>(`SELECT saved_count FROM share_sessions WHERE id = $1`, [share.id])
    expect(s.saved_count).toBe(1)
    const identifiable = await (await db()).query(`SELECT 1 FROM interactions WHERE share_session_id = $1 AND recipient_id IS NOT NULL`, [share.id])
    expect(identifiable).toHaveLength(0)
  })

  it('quick share reuses the live default link instead of piling up sessions', async () => {
    const sender = await makeUser('pro')
    await createCapsule(sender.id, { name: 'Default', mode: 'professional', display_name: 'D', fields: fields() })
    const a = await quickShare(sender.id)
    const b = await quickShare(sender.id)
    expect(b.id).toBe(a.id)
    expect(b.reused).toBe(true)
    await revokeShare(sender.id, a.id)
    const c = await quickShare(sender.id)
    expect(c.id).not.toBe(a.id)
  })
})
