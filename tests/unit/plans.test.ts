import { describe, expect, it } from 'vitest'
import { makeUser, fields, db } from './helpers'
import { createCapsule, updatePolicy } from '@/lib/server/services/capsules'
import { startShare, resolveShare } from '@/lib/server/services/sharing'
import { addNote, addFollowUp } from '@/lib/server/services/connections'
import { createOrg } from '@/lib/server/services/orgs'
import { updatePlan } from '@/lib/server/services/admin'
import { AppError, PlanGateError } from '@/lib/server/errors'

describe('capability gates', () => {
  it('free: one capsule, no expanded layer, no notes/follow-ups/workspaces — but safety controls work', async () => {
    const u = await makeUser('free')
    const id = await createCapsule(u.id, { name: 'One', mode: 'professional', display_name: 'U', fields: fields() })
    await expect(createCapsule(u.id, { name: 'Two', mode: 'personal', display_name: 'U' })).rejects.toBeInstanceOf(PlanGateError)
    // Expanded-layer fields are shown first on Free rather than silently dropped.
    const share = await startShare(u.id, { capsuleId: id, oneTime: true, durationMinutes: 15 })
    const r = await resolveShare(share.token, { claimToken: 'x', record: true })
    if (r.status !== 'ok') throw new Error('ok expected')
    expect(r.view.fields.map((f) => f.label)).toEqual(['Role', 'Email', 'Website'])
    expect(r.view.oneTime).toBe(true)
    await expect(updatePolicy(u.id, id, { duration_minutes: null, one_time: false, interaction_level: 'connect', allow_expanded: true })).rejects.toBeInstanceOf(PlanGateError)
    const [con] = await (await db()).query<{ id: string }>(`INSERT INTO connections (id, owner_user_id, name, source) VALUES ('con_free', $1, 'X', 'manual') RETURNING id`, [u.id])
    await expect(addNote(u.id, con.id, 'hi')).rejects.toBeInstanceOf(PlanGateError)
    await expect(addFollowUp(u.id, con.id, { title: 't', dueOn: '2026-10-10' })).rejects.toBeInstanceOf(PlanGateError)
    await expect(createOrg(u.id, 'Nope Inc')).rejects.toBeInstanceOf(PlanGateError)
    await expect(startShare(u.id, { capsuleId: id, channel: 'nfc_tag' })).rejects.toBeInstanceOf(PlanGateError)
    const gates = await (await db()).query(`SELECT 1 FROM analytics_events WHERE name = 'plan_gate_hit' AND user_id = $1`, [u.id])
    expect(gates.length).toBeGreaterThan(0)
  })

  it('plan limits are data: changing the catalog changes behaviour without a deploy', async () => {
    const admin = await makeUser('free')
    await (await db()).query(`UPDATE users SET is_platform_admin = true WHERE id = $1`, [admin.id])
    await updatePlan(admin.id, 'pro', { priceLabel: null, capsules: 2, historyDays: 365 })
    const u = await makeUser('pro')
    await createCapsule(u.id, { name: 'A', mode: 'professional', display_name: 'U' })
    await createCapsule(u.id, { name: 'B', mode: 'personal', display_name: 'U' })
    await expect(createCapsule(u.id, { name: 'C', mode: 'social', display_name: 'U' })).rejects.toBeInstanceOf(AppError)
    await updatePlan(admin.id, 'pro', { priceLabel: null, capsules: 10, historyDays: 365 })
    await expect(createCapsule(u.id, { name: 'C', mode: 'social', display_name: 'U' })).resolves.toBeTruthy()
  })
})

describe('input validation', () => {
  it('rejects script URLs and malformed contact details', async () => {
    const u = await makeUser('pro')
    const bad = (value: string, kind: 'website' | 'email' | 'phone' = 'website') => createCapsule(u.id, { name: 'X', mode: 'custom', display_name: 'X', fields: [{ id: 'f_bad001', kind, label: 'L', value, layer: 'instant' }] })
    await expect(bad('javascript:alert(1)')).rejects.toThrow()
    await expect(bad('data:text/html,<script>')).rejects.toThrow()
    await expect(bad('not an email', 'email')).rejects.toThrow()
    await expect(bad('call me maybe', 'phone')).rejects.toThrow()
    const ok = await createCapsule(u.id, { name: 'Y', mode: 'custom', display_name: '<img src=x onerror=alert(1)>', fields: [{ id: 'f_ok0001', kind: 'website', label: 'Site', value: 'example.com', layer: 'instant' }] })
    const share = await startShare(u.id, { capsuleId: ok })
    const r = await resolveShare(share.token)
    if (r.status !== 'ok') throw new Error('ok expected')
    expect(r.view.fields[0].value).toBe('https://example.com') // normalised to https
    expect(r.view.displayName).toBe('<img src=x onerror=alert(1)>') // stored as text; React escapes on render
  })
})
