import 'server-only'
import { z } from 'zod'
import { getDb } from '../db'
import { newId } from '../ids'
import { audit } from '../audit'
import { track } from '../analytics'
import { invalid } from '../errors'
import { rateLimit } from '../ratelimit'
import { has, requireCapability, userPlan } from '../plans'
import { resolveShare } from './sharing'
import { INDUSTRIES, isIndustry } from '../../industries'

/**
 * Who viewed you (founders' decision, 2026-09-30).
 * - A signed-in ORYN member who opens a capsule is recorded by name for the owner — unless they chose
 *   private viewing. They are told this on the capsule page before anything else.
 * - People without an ORYN account stay anonymous (counts only).
 * - Seeing names and interest analytics is a Premium capability (`insights.viewers`).
 */
export async function recordMemberView(e: { capsuleId: string; ownerId: string; viewerId: string; shareSessionId: string; expanded: boolean }) {
  if (e.viewerId === e.ownerId) return false
  const db = await getDb()
  const [viewer] = await db.query<{ view_visibility: string }>(`SELECT view_visibility FROM users WHERE id = $1 AND deleted_at IS NULL`, [e.viewerId])
  if (!viewer || viewer.view_visibility !== 'visible') return false
  await db.query(
    `INSERT INTO capsule_views (id, capsule_id, owner_user_id, viewer_user_id, share_session_id, expanded)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (capsule_id, viewer_user_id) DO UPDATE SET
       view_count = capsule_views.view_count + 1, last_viewed_at = now(), share_session_id = EXCLUDED.share_session_id,
       expanded = capsule_views.expanded OR EXCLUDED.expanded`,
    [newId('cv'), e.capsuleId, e.ownerId, e.viewerId, e.shareSessionId, e.expanded],
  )
  return true
}

/** What every owner gets for free: totals, and how many of the viewers were ORYN members. */
export async function viewerSummary(ownerId: string) {
  const db = await getDb()
  const [s] = await db.query<{ opens: number; members: number; recent_members: number }>(
    `SELECT (SELECT count(*)::int FROM interactions WHERE owner_user_id = $1 AND kind = 'opened' AND created_at > now() - interval '30 days') AS opens,
            (SELECT count(*)::int FROM capsule_views WHERE owner_user_id = $1 AND last_viewed_at > now() - interval '30 days') AS members,
            (SELECT count(*)::int FROM capsule_views WHERE owner_user_id = $1 AND last_viewed_at > now() - interval '1 day') AS recent_members`,
    [ownerId],
  )
  const plan = await userPlan(db, ownerId)
  return { ...s, canSeeWho: has(plan, 'insights.viewers') }
}

export interface MemberViewer { id: string; viewer_id: string; name: string; headline: string; industry: string | null; capsule_name: string; view_count: number; expanded: boolean; last_viewed_at: Date; first_viewed_at: Date }

/** Premium: the members who viewed you, newest first. */
export async function listViewers(ownerId: string, limit = 50) {
  const db = await getDb()
  await requireCapability(db, await userPlan(db, ownerId), 'insights.viewers', ownerId)
  return db.query<MemberViewer>(
    `SELECT v.id, u.id AS viewer_id, u.display_name AS name, u.profile_headline AS headline, u.industry, c.name AS capsule_name,
            v.view_count, v.expanded, v.last_viewed_at, v.first_viewed_at
       FROM capsule_views v JOIN users u ON u.id = v.viewer_user_id JOIN capsules c ON c.id = v.capsule_id
      WHERE v.owner_user_id = $1 AND u.deleted_at IS NULL
      ORDER BY v.last_viewed_at DESC LIMIT $2`,
    [ownerId, limit],
  )
}

/** Premium: fields the viewers work in, what they tapped, and viewing over time. */
export async function interestAnalytics(ownerId: string) {
  const db = await getDb()
  await requireCapability(db, await userPlan(db, ownerId), 'insights.viewers', ownerId)
  const byIndustry = await db.query<{ industry: string | null; viewers: number }>(
    `SELECT u.industry, count(*)::int AS viewers FROM capsule_views v JOIN users u ON u.id = v.viewer_user_id
      WHERE v.owner_user_id = $1 AND v.last_viewed_at > now() - interval '90 days' GROUP BY u.industry ORDER BY viewers DESC`, [ownerId])
  const byField = await db.query<{ field_kind: string; taps: number }>(
    `SELECT field_kind, count(*)::int AS taps FROM interactions
      WHERE owner_user_id = $1 AND kind = 'field_clicked' AND created_at > now() - interval '90 days' AND field_kind IS NOT NULL
      GROUP BY field_kind ORDER BY taps DESC`, [ownerId])
  const perDay = await db.query<{ day: string; opens: number }>(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day, (SELECT count(*)::int FROM interactions i WHERE i.owner_user_id = $1 AND i.kind = 'opened' AND i.created_at >= d AND i.created_at < d + interval '1 day') AS opens
       FROM generate_series(current_date - 13, current_date, interval '1 day') d ORDER BY d`, [ownerId])
  const [r] = await db.query<{ returning: number; members: number }>(
    `SELECT count(*) FILTER (WHERE view_count > 1)::int AS returning, count(*)::int AS members FROM capsule_views WHERE owner_user_id = $1`, [ownerId])
  return { byIndustry, byField, perDay, returning: r.returning, members: r.members }
}

/** A recipient tapped one of the details they were shown. Anonymous: only the kind of detail is kept. */
export async function recordFieldTap(token: string, fieldId: string, ctx: { claimToken: string | null; ipKey: string }) {
  if (!/^f_[A-Za-z0-9_-]{4,24}$/.test(fieldId)) return
  const res = await resolveShare(token, { layer: 'expanded', claimToken: ctx.claimToken })
  if (res.status !== 'ok') return
  const field = res.view.fields.find((f) => f.id === fieldId)
  if (!field) return // only details this recipient could actually see
  const db = await getDb()
  await rateLimit(db, `tap:${res.session.id}:${ctx.ipKey}`, 30, 3600)
  await db.query(`INSERT INTO interactions (id, share_session_id, owner_user_id, kind, field_kind) VALUES ($1,$2,$3,'field_clicked',$4)`, [newId('int'), res.session.id, res.session.owner_user_id, field.kind])
  await track(db, 'public_card_cta_clicked', { userId: res.session.owner_user_id, props: { card_id: res.session.capsule_id, channel: res.session.channel, source: field.kind } })
}

const profileInput = z.object({
  display_name: z.string().trim().min(1, 'Add your name.').max(80),
  profile_headline: z.string().trim().max(90).default(''),
  industry: z.string().nullable().refine((v) => v === null || isIndustry(v), 'Choose a field from the list.'),
  view_visibility: z.enum(['visible', 'private']),
})

export async function getProfile(userId: string) {
  const db = await getDb()
  const [p] = await db.query<{ display_name: string; profile_headline: string; industry: string | null; view_visibility: 'visible' | 'private' }>(
    `SELECT display_name, profile_headline, industry, view_visibility FROM users WHERE id = $1`, [userId])
  return p
}

export async function updateProfile(userId: string, input: z.input<typeof profileInput>) {
  const r = profileInput.safeParse(input)
  if (!r.success) throw invalid(r.error.issues[0].message)
  const db = await getDb()
  const before = await getProfile(userId)
  await db.query(`UPDATE users SET display_name = $2, profile_headline = $3, industry = $4, view_visibility = $5 WHERE id = $1`, [
    userId, r.data.display_name, r.data.profile_headline, r.data.industry, r.data.view_visibility,
  ])
  await audit(db, { actor: userId, action: 'profile.updated', targetType: 'user', targetId: userId, meta: { visibilityChanged: before?.view_visibility !== r.data.view_visibility, visibility: r.data.view_visibility } })
  if (before?.view_visibility !== r.data.view_visibility) await track(db, 'privacy_control_used', { userId, props: { control: 'view_visibility', value: r.data.view_visibility } })
}

export const INDUSTRY_OPTIONS = INDUSTRIES
