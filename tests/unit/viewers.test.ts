import { describe, expect, it } from 'vitest'
import { makeUser, fields, db } from './helpers'
import { createCapsule } from '@/lib/server/services/capsules'
import { startShare, resolveShare } from '@/lib/server/services/sharing'
import { buildExport, requestExport } from '@/lib/server/services/privacy'
import { interestAnalytics, listViewers, recordFieldTap, recordMemberView, updateProfile, viewerSummary } from '@/lib/server/services/viewers'
import { AppError } from '@/lib/server/errors'

async function ownerWithShare(plan: 'free' | 'pro') {
  const owner = await makeUser(plan, 'Owner Person')
  const capsuleId = await createCapsule(owner.id, { name: 'Card', mode: 'professional', display_name: 'Owner Person', fields: fields() })
  const share = await startShare(owner.id, { capsuleId })
  const r = await resolveShare(share.token, { record: true, claimToken: 'b1' })
  if (r.status !== 'ok') throw new Error('share')
  return { owner, capsuleId, share, sessionId: r.session.id }
}

describe('who viewed you (founders’ decision 2026-09-30)', () => {
  it('records a signed-in member by profile, and a Pro owner sees them with their field', async () => {
    const { owner, capsuleId, sessionId } = await ownerWithShare('pro')
    const viewer = await makeUser('free', 'Dana Viewer')
    await updateProfile(viewer.id, { display_name: 'Dana Viewer', profile_headline: 'Investor · Haifa', industry: 'finance', view_visibility: 'visible' })
    expect(await recordMemberView({ capsuleId, ownerId: owner.id, viewerId: viewer.id, shareSessionId: sessionId, expanded: false })).toBe(true)
    expect(await recordMemberView({ capsuleId, ownerId: owner.id, viewerId: viewer.id, shareSessionId: sessionId, expanded: true })).toBe(true)

    const list = await listViewers(owner.id)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ name: 'Dana Viewer', headline: 'Investor · Haifa', industry: 'finance', view_count: 2, expanded: true, capsule_name: 'Card' })
    const s = await viewerSummary(owner.id)
    expect(s).toMatchObject({ members: 1, recent_members: 1, canSeeWho: true })
    const ia = await interestAnalytics(owner.id)
    expect(ia.byIndustry).toEqual([{ industry: 'finance', viewers: 1 }])
    expect(ia.returning).toBe(1)
    expect(ia.perDay).toHaveLength(14)
    expect(ia.perDay.at(-1)!.opens).toBeGreaterThanOrEqual(1)
  })

  it('never records private viewers, the owner themself, or deleted accounts', async () => {
    const { owner, capsuleId, sessionId } = await ownerWithShare('pro')
    const priv = await makeUser('free', 'Private Viewer')
    await updateProfile(priv.id, { display_name: 'Private Viewer', profile_headline: '', industry: null, view_visibility: 'private' })
    expect(await recordMemberView({ capsuleId, ownerId: owner.id, viewerId: priv.id, shareSessionId: sessionId, expanded: false })).toBe(false)
    expect(await recordMemberView({ capsuleId, ownerId: owner.id, viewerId: owner.id, shareSessionId: sessionId, expanded: false })).toBe(false)
    const d = await db()
    const gone = await makeUser('free', 'Gone Viewer')
    await d.query(`UPDATE users SET deleted_at = now() WHERE id = $1`, [gone.id])
    expect(await recordMemberView({ capsuleId, ownerId: owner.id, viewerId: gone.id, shareSessionId: sessionId, expanded: false })).toBe(false)
    expect(await listViewers(owner.id)).toHaveLength(0)
  })

  it('free owners get counts only; names and analytics need insights.viewers', async () => {
    const { owner, capsuleId, sessionId } = await ownerWithShare('free')
    const viewer = await makeUser('free', 'Some Member')
    await recordMemberView({ capsuleId, ownerId: owner.id, viewerId: viewer.id, shareSessionId: sessionId, expanded: false })
    expect(await viewerSummary(owner.id)).toMatchObject({ members: 1, canSeeWho: false })
    await expect(listViewers(owner.id)).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'plan')
    await expect(interestAnalytics(owner.id)).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'plan')
  })

  it('profile validation: unknown fields are refused and the change is audited without the values', async () => {
    const u = await makeUser('free', 'Profile Person')
    await expect(updateProfile(u.id, { display_name: 'X', profile_headline: '', industry: 'astrology', view_visibility: 'visible' })).rejects.toThrow('Choose a field')
    await expect(updateProfile(u.id, { display_name: ' ', profile_headline: '', industry: null, view_visibility: 'visible' })).rejects.toThrow('Add your name')
    await updateProfile(u.id, { display_name: 'Profile Person', profile_headline: 'SECRET-HEADLINE', industry: 'tech', view_visibility: 'private' })
    const d = await db()
    const rows = await d.query<{ meta: unknown }>(`SELECT meta FROM audit_events WHERE actor_user_id = $1 AND action = 'profile.updated'`, [u.id])
    expect(rows).toHaveLength(1)
    expect(JSON.stringify(rows)).not.toContain('SECRET-HEADLINE')
  })

  it('field taps: only details the recipient could see, stored as a kind with no identity', async () => {
    const { owner, share } = await ownerWithShare('pro')
    await recordFieldTap(share.token, 'f_mail01', { claimToken: 'b1', ipKey: 'tap-1' }) // instant
    await recordFieldTap(share.token, 'f_site01', { claimToken: 'b1', ipKey: 'tap-1' }) // learn more
    await recordFieldTap(share.token, 'f_phon01', { claimToken: 'b1', ipKey: 'tap-1' }) // hidden → ignored
    await recordFieldTap(share.token, 'not-a-field', { claimToken: 'b1', ipKey: 'tap-1' })
    await recordFieldTap('bad.token.value', 'f_mail01', { claimToken: 'b1', ipKey: 'tap-1' })
    const ia = await interestAnalytics(owner.id)
    expect(ia.byField.map((f) => f.field_kind).sort()).toEqual(['email', 'website'])
    const d = await db()
    const taps = await d.query(`SELECT * FROM interactions WHERE owner_user_id = $1 AND kind = 'field_clicked'`, [owner.id])
    expect(JSON.stringify(taps)).not.toContain('me@example.com')
    expect(JSON.stringify(taps)).not.toContain('tap-1')
  })

  it('export includes who viewed me and what I viewed', async () => {
    const { owner, capsuleId, sessionId } = await ownerWithShare('pro')
    const viewer = await makeUser('free', 'Export Viewer')
    await recordMemberView({ capsuleId, ownerId: owner.id, viewerId: viewer.id, shareSessionId: sessionId, expanded: false })
    const d = await db()
    for (const [u, key] of [[owner.id, 'membersWhoViewedMe'], [viewer.id, 'capsulesIViewed']] as const) {
      const id = await requestExport(u)
      await buildExport(d, id, u)
      const [row] = await d.query<{ payload: Record<string, unknown[]> }>(`SELECT payload FROM data_exports WHERE id = $1`, [id])
      expect(row.payload[key]).toHaveLength(1)
    }
  })
})
