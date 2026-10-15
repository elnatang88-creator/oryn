import 'server-only'
import { z } from 'zod'
import { getDb } from '../db'
import { walletStatus } from '../wallet'
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

// ─── Command Center modules ──────────────────────────────────────────────────────────────────────
export const ADMIN_MODULES = ['users', 'businesses', 'events', 'stations', 'subscriptions', 'wallet', 'reports', 'health', 'audit', 'flags'] as const
export type AdminModule = (typeof ADMIN_MODULES)[number]

export async function adminModule(adminId: string, module: AdminModule, q = '') {
  const db = await getDb()
  await requirePlatformAdmin(db, adminId)
  await audit(db, { actor: adminId, action: 'admin.module_viewed', targetType: 'platform', meta: { module } })
  const like = `%${q.slice(0, 60)}%`
  switch (module) {
    case 'users':
      return db.query(`SELECT id, email, display_name, plan_key, is_platform_admin, email_verified_at, created_at, deleted_at FROM users WHERE ($1 = '%%' OR email ILIKE $1 OR display_name ILIKE $1) ORDER BY created_at DESC LIMIT 100`, [like])
    case 'businesses':
      return db.query(`SELECT o.id, o.name, o.plan_key, o.created_at, (SELECT count(*)::int FROM memberships m WHERE m.org_id = o.id) AS members, (SELECT count(*)::int FROM leads l WHERE l.org_id = o.id) AS leads, (SELECT count(*)::int FROM stations s WHERE s.org_id = o.id) AS stations FROM organizations o WHERE ($1 = '%%' OR o.name ILIKE $1) ORDER BY o.created_at DESC LIMIT 100`, [like])
    case 'events':
      return db.query(`SELECT e.id, e.name, e.status, e.published, e.slug, o.name AS org, (SELECT count(*)::int FROM registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') AS confirmed, (SELECT count(*)::int FROM registrations r WHERE r.event_id = e.id AND r.checked_in_at IS NOT NULL) AS checked_in FROM events e JOIN organizations o ON o.id = e.org_id WHERE ($1 = '%%' OR e.name ILIKE $1) ORDER BY e.created_at DESC LIMIT 100`, [like])
    case 'stations':
      return db.query(`SELECT st.id, st.name, st.mode, st.status, o.name AS org, q.code, (SELECT count(*)::int FROM station_interactions i WHERE i.station_id = st.id AND i.kind = 'scan' AND i.created_at > now() - interval '30 days') AS scans_30d FROM stations st JOIN organizations o ON o.id = st.org_id JOIN qr_destinations q ON q.station_id = st.id WHERE ($1 = '%%' OR st.name ILIKE $1) ORDER BY st.created_at DESC LIMIT 100`, [like])
    case 'subscriptions':
      return db.query(`SELECT plan_key, count(*)::int AS users FROM users WHERE deleted_at IS NULL GROUP BY plan_key ORDER BY users DESC`)
    case 'wallet':
      return db.query(`SELECT count(*)::int AS pass_links, count(*) FILTER (WHERE revoked_at IS NOT NULL)::int AS stopped FROM share_sessions WHERE channel = 'wallet_pass'`)
    case 'health': {
      const [jobs] = await db.query<Record<string, number>>(`SELECT count(*) FILTER (WHERE status = 'queued')::int AS queued, count(*) FILTER (WHERE status = 'running')::int AS running, count(*) FILTER (WHERE status = 'failed')::int AS failed, count(*) FILTER (WHERE status = 'done' AND created_at > now() - interval '1 day')::int AS done_24h FROM jobs`)
      const [mail] = await db.query<Record<string, number>>(`SELECT count(*) FILTER (WHERE status = 'queued')::int AS queued, count(*) FILTER (WHERE status = 'sent')::int AS sent, count(*) FILTER (WHERE status = 'failed')::int AS failed, count(*) FILTER (WHERE status = 'skipped')::int AS skipped FROM email_outbox`)
      const [runs] = await db.query<Record<string, number>>(`SELECT count(*) FILTER (WHERE status = 'failed')::int AS failed_runs, count(*) FILTER (WHERE created_at > now() - interval '1 day')::int AS runs_24h FROM automation_runs`)
      const [presence] = await db.query<Record<string, number>>(`SELECT count(*)::int AS nearby_present FROM nearby_presence WHERE expires_at > now()`)
      return [{ ...jobs, ...Object.fromEntries(Object.entries(mail).map(([k, v]) => [`mail_${k}`, v])), ...runs, ...presence }]
    }
    case 'reports':
      return db.query(`SELECT r.id, r.reason, r.status, r.surface, left(r.details, 120) AS details, rep.email AS reported, u.email AS reporter, r.created_at
                         FROM abuse_reports r JOIN users rep ON rep.id = r.reported_user_id LEFT JOIN users u ON u.id = r.reporter_user_id
                        WHERE ($1 = '%%' OR rep.email ILIKE $1 OR r.reason ILIKE $1) ORDER BY (r.status = 'open') DESC, r.created_at DESC LIMIT 200`, [like])
    case 'audit':
      return db.query(`SELECT a.id, a.action, a.target_type, a.target_id, a.created_at, u.email AS actor FROM audit_events a LEFT JOIN users u ON u.id = a.actor_user_id WHERE ($1 = '%%' OR a.action ILIKE $1 OR coalesce(u.email, '') ILIKE $1) ORDER BY a.created_at DESC LIMIT 200`, [like])
    case 'flags':
      return db.query(`SELECT key, enabled, description, updated_at FROM feature_flags ORDER BY key`)
  }
}

export interface OpsAlert { level: 'critical' | 'warning' | 'info'; title: string; detail: string }

/**
 * Operational alerts: what an operator should act on now, derived from live counts and configuration.
 * No secrets are read back — only whether something is set.
 */
export async function operationalAlerts(adminId: string): Promise<OpsAlert[]> {
  const db = await getDb()
  await requirePlatformAdmin(db, adminId)
  const prod = process.env.NODE_ENV === 'production'
  const [j] = await db.query<{ failed: number; stuck: number; overdue: number }>(
    `SELECT count(*) FILTER (WHERE status = 'failed')::int AS failed,
            count(*) FILTER (WHERE status = 'running' AND run_at < now() - interval '15 minutes')::int AS stuck,
            count(*) FILTER (WHERE status = 'queued' AND run_at < now() - interval '10 minutes')::int AS overdue FROM jobs`)
  const [m] = await db.query<{ failed: number; skipped_24h: number; queued_old: number }>(
    `SELECT count(*) FILTER (WHERE status = 'failed')::int AS failed,
            count(*) FILTER (WHERE status = 'skipped' AND created_at > now() - interval '1 day')::int AS skipped_24h,
            count(*) FILTER (WHERE status = 'queued' AND created_at < now() - interval '30 minutes')::int AS queued_old FROM email_outbox`)
  const [r] = await db.query<{ failed_24h: number }>(`SELECT count(*) FILTER (WHERE status = 'failed' AND created_at > now() - interval '1 day')::int AS failed_24h FROM automation_runs`)
  const [u] = await db.query<{ demo: number }>(`SELECT count(*)::int AS demo FROM users WHERE email LIKE '%@oryn.local'`)
  const [rep] = await db.query<{ open: number }>(`SELECT count(*)::int AS open FROM abuse_reports WHERE status = 'open'`)
  const out: OpsAlert[] = []
  if (j.failed) out.push({ level: 'critical', title: `${j.failed} failed job${j.failed === 1 ? '' : 's'}`, detail: 'Jobs exhausted their retries. Inspect last_error in the jobs table; re-queue after fixing the cause.' })
  if (j.stuck) out.push({ level: 'warning', title: `${j.stuck} job${j.stuck === 1 ? '' : 's'} running for over 15 minutes`, detail: 'A worker may have died mid-job. The next run reclaims them; if it repeats, check the scheduler container.' })
  if (j.overdue) out.push({ level: 'warning', title: `${j.overdue} queued job${j.overdue === 1 ? '' : 's'} overdue`, detail: 'The scheduler is not calling /api/jobs. Check CRON_SECRET and the scheduler service.' })
  if (m.failed) out.push({ level: 'critical', title: `${m.failed} email${m.failed === 1 ? '' : 's'} failed to send`, detail: 'SMTP rejected the message or the server is unreachable. See email_outbox.last_error.' })
  if (m.queued_old) out.push({ level: 'warning', title: `${m.queued_old} email${m.queued_old === 1 ? '' : 's'} waiting over 30 minutes`, detail: 'Delivery jobs are not running. Check the scheduler.' })
  if (prod && m.skipped_24h) out.push({ level: 'warning', title: `${m.skipped_24h} email${m.skipped_24h === 1 ? '' : 's'} skipped in the last 24 h`, detail: 'EMAIL_TRANSPORT is not set to smtp. Verification, reset and ticket mails reach nobody.' })
  if (r.failed_24h) out.push({ level: 'warning', title: `${r.failed_24h} automation run${r.failed_24h === 1 ? '' : 's'} failed today`, detail: 'Open Business → Automations → run log for the error.' })
  if (rep.open) out.push({ level: 'warning', title: `${rep.open} open abuse report${rep.open === 1 ? '' : 's'}`, detail: 'Review them under Command Center → Reports.' })
  if (!process.env.CRON_SECRET) out.push({ level: prod ? 'critical' : 'info', title: 'No CRON_SECRET', detail: 'Background jobs (email, automations, reminders, deletions) cannot be triggered.' })
  if (prod && (process.env.EMAIL_TRANSPORT ?? 'none') !== 'smtp') out.push({ level: 'warning', title: 'Email transport is not SMTP', detail: 'Set EMAIL_TRANSPORT=smtp and SMTP_URL to deliver mail.' })
  if (prod && u.demo) out.push({ level: 'critical', title: `${u.demo} demo account${u.demo === 1 ? '' : 's'} present in production`, detail: 'ORYN_SEED_DEMO must be false in production; remove the @oryn.local accounts.' })
  if (!walletStatus().apple.configured || !walletStatus().google.configured) out.push({ level: 'info', title: 'Wallet integrations pending', detail: `Apple: ${walletStatus().apple.configured ? 'configured' : 'missing certificates'} · Google: ${walletStatus().google.configured ? 'configured' : 'missing issuer account'}. Members see “Integration pending”.` })
  return out
}
