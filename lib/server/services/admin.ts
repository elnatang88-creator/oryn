import 'server-only'
import { z } from 'zod'
import { getDb } from '../db'
import { audit } from '../audit'
import { invalid, notFound } from '../errors'
import { requirePlatformAdmin } from '../permissions'
import { listPlans } from '../plans'

export async function adminOverview(adminId: string) {
  const db = await getDb()
  await requirePlatformAdmin(db, adminId)
  await audit(db, { actor: adminId, action: 'admin.console_viewed', targetType: 'platform' })
  const [stats] = await db.query<Record<string, number>>(
    // Counts exclude fictional demo accounts (.local domain).
    `SELECT (SELECT count(*)::int FROM users WHERE deleted_at IS NULL AND email NOT LIKE '%@oryn.local') AS users,
            (SELECT count(*)::int FROM organizations WHERE id <> 'org_demo') AS orgs,
            (SELECT count(*)::int FROM capsules c JOIN users u ON u.id = c.owner_user_id WHERE c.status='active' AND u.email NOT LIKE '%@oryn.local') AS capsules,
            (SELECT count(*)::int FROM share_sessions s JOIN users u ON u.id = s.owner_user_id WHERE s.created_at > now() - interval '7 days' AND u.email NOT LIKE '%@oryn.local') AS shares_7d,
            (SELECT count(*)::int FROM jobs WHERE status = 'failed') AS failed_jobs,
            (SELECT count(*)::int FROM interactions WHERE kind = 'reported' AND created_at > now() - interval '30 days') AS reports_30d`)
  const users = await db.query<{ id: string; email: string; display_name: string; plan_key: string; created_at: Date; is_platform_admin: boolean }>(
    `SELECT id, email, display_name, plan_key, created_at, is_platform_admin FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 50`)
  const plans = await listPlans(db)
  const flags = await db.query<{ key: string; enabled: boolean; description: string }>(`SELECT key, enabled, description FROM feature_flags ORDER BY key`)
  const auditLog = await db.query<{ id: string; action: string; target_type: string; created_at: Date; actor: string | null }>(
    `SELECT a.id, a.action, a.target_type, a.created_at, u.email AS actor FROM audit_events a LEFT JOIN users u ON u.id = a.actor_user_id ORDER BY a.created_at DESC LIMIT 60`)
  const reports = await db.query<{ id: string; created_at: Date; meta: { reason?: string } }>(
    `SELECT id, created_at, meta FROM audit_events WHERE action = 'share.reported' ORDER BY created_at DESC LIMIT 20`)
  return { stats, users, plans, flags, auditLog, reports }
}

export async function setFlag(adminId: string, key: string, enabled: boolean) {
  const db = await getDb()
  await requirePlatformAdmin(db, adminId)
  const r = await db.query(`UPDATE feature_flags SET enabled = $2, updated_at = now() WHERE key = $1 RETURNING key`, [key, enabled])
  if (!r.length) throw notFound('That flag')
  await audit(db, { actor: adminId, action: 'admin.flag_changed', targetType: 'feature_flag', targetId: key, meta: { enabled } })
}

const planEdit = z.object({
  priceLabel: z.string().trim().max(40).nullable(),
  capsules: z.number().int().min(1).max(1000),
  historyDays: z.number().int().min(7).max(3650),
})

/** Prices and limits are data. Changing them never needs a deploy. */
export async function updatePlan(adminId: string, key: string, input: z.input<typeof planEdit>) {
  const r = planEdit.safeParse(input)
  if (!r.success) throw invalid(r.error.issues[0].message)
  const db = await getDb()
  await requirePlatformAdmin(db, adminId)
  const res = await db.query(
    `UPDATE plan_catalog SET price_label = $2, limits = limits || jsonb_build_object('capsules', $3::int, 'historyDays', $4::int), updated_at = now() WHERE key = $1 RETURNING key`,
    [key, r.data.priceLabel || null, r.data.capsules, r.data.historyDays],
  )
  if (!res.length) throw notFound('That plan')
  await audit(db, { actor: adminId, action: 'admin.plan_updated', targetType: 'plan', targetId: key, meta: r.data })
}

export async function setUserPlanAsAdmin(adminId: string, userId: string, planKey: string) {
  const db = await getDb()
  await requirePlatformAdmin(db, adminId)
  const [p] = await db.query(`SELECT 1 FROM plan_catalog WHERE key = $1`, [planKey])
  if (!p) throw notFound('That plan')
  await db.query(`UPDATE users SET plan_key = $2 WHERE id = $1`, [userId, planKey])
  await audit(db, { actor: adminId, action: 'admin.user_plan_changed', targetType: 'user', targetId: userId, meta: { planKey } })
}

export async function isFlagOn(key: string) {
  const db = await getDb()
  const [f] = await db.query<{ enabled: boolean }>(`SELECT enabled FROM feature_flags WHERE key = $1`, [key])
  return !!f?.enabled
}
