import 'server-only'
import { z } from 'zod'
import { getDb, type Db } from '../db'
import { newId } from '../ids'
import { invalid, notFound } from '../errors'
import { audit } from '../audit'
import { track } from '../analytics'
import { requireOrgPermission } from '../permissions'
import { queueEmail } from '../email'
import { enqueue } from '../jobs'

/**
 * First-party automation engine. A trigger fires inside the workspace; every enabled automation whose
 * conditions match gets ONE run per subject (idempotency key), executed by the job queue (retries, backoff,
 * failure logging). Actions are small and explicit. Email actions are transactional and go to people inside
 * the flow (the lead who consented, the registrant, the assignee) — never to lists.
 */
export const TRIGGERS = ['lead.created', 'lead.stage_changed', 'registration.created', 'checkin.created', 'connection.created', 'task.due', 'meeting.requested'] as const
export type Trigger = (typeof TRIGGERS)[number]
export const TRIGGER_LABEL: Record<Trigger, string> = {
  'lead.created': 'New lead', 'lead.stage_changed': 'Lead stage changed', 'registration.created': 'Event registration',
  'checkin.created': 'Event check-in', 'connection.created': 'New connection', 'task.due': 'Task due', 'meeting.requested': 'Meeting requested',
}

const action = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create_task'), title: z.string().trim().min(1).max(120), dueInDays: z.number().int().min(0).max(365).default(1), assignee: z.string().max(40).default('assignee') }),
  z.object({ type: z.literal('assign_lead'), userId: z.string().max(40) }),
  z.object({ type: z.literal('update_stage'), stage: z.string().trim().min(1).max(40) }),
  z.object({ type: z.literal('notify'), to: z.enum(['assignee', 'creator', 'managers']).default('managers'), body: z.string().trim().min(1).max(200) }),
  z.object({ type: z.literal('send_email'), to: z.enum(['lead', 'registrant', 'assignee']), subject: z.string().trim().min(1).max(120), text: z.string().trim().min(1).max(2000) }),
  z.object({ type: z.literal('schedule_reminder'), title: z.string().trim().min(1).max(120), inDays: z.number().int().min(1).max(365).default(3) }),
])
export type Action = z.infer<typeof action>
const automationInput = z.object({
  name: z.string().trim().min(2).max(80),
  trigger: z.enum(TRIGGERS),
  conditions: z.record(z.string().max(30), z.string().max(80)).default({}),
  actions: z.array(action).min(1).max(6),
  enabled: z.boolean().default(true),
})

export async function listAutomations(userId: string, orgId: string) {
  const db = await getDb()
  await requireOrgPermission(db, userId, orgId, 'automations.manage')
  return db.query<{ id: string; name: string; trigger: Trigger; conditions: Record<string, string>; actions: Action[]; enabled: boolean; created_at: Date; runs: number; last_run: Date | null }>(
    `SELECT a.*, (SELECT count(*)::int FROM automation_runs r WHERE r.automation_id = a.id) AS runs, (SELECT max(created_at) FROM automation_runs r WHERE r.automation_id = a.id) AS last_run
       FROM automations a WHERE a.org_id = $1 ORDER BY a.created_at DESC`, [orgId])
}

export async function createAutomation(userId: string, orgId: string, input: z.input<typeof automationInput>) {
  const r = automationInput.safeParse(input)
  if (!r.success) throw invalid(r.error.issues[0].message)
  const db = await getDb()
  await requireOrgPermission(db, userId, orgId, 'automations.manage')
  const id = newId('auto')
  await db.query(`INSERT INTO automations (id, org_id, name, trigger, conditions, actions, enabled, created_by) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8)`,
    [id, orgId, r.data.name, r.data.trigger, JSON.stringify(r.data.conditions), JSON.stringify(r.data.actions), r.data.enabled, userId])
  await audit(db, { actor: userId, action: 'automation.created', targetType: 'automation', targetId: id, orgId, meta: { trigger: r.data.trigger } })
  return id
}

export async function setAutomationEnabled(userId: string, automationId: string, enabled: boolean) {
  const db = await getDb()
  const [a] = await db.query<{ org_id: string }>(`SELECT org_id FROM automations WHERE id = $1`, [automationId])
  if (!a) throw notFound('That automation')
  await requireOrgPermission(db, userId, a.org_id, 'automations.manage')
  await db.query(`UPDATE automations SET enabled = $2 WHERE id = $1`, [automationId, enabled])
  await audit(db, { actor: userId, action: enabled ? 'automation.enabled' : 'automation.disabled', targetType: 'automation', targetId: automationId, orgId: a.org_id })
}

export async function deleteAutomation(userId: string, automationId: string) {
  const db = await getDb()
  const [a] = await db.query<{ org_id: string }>(`SELECT org_id FROM automations WHERE id = $1`, [automationId])
  if (!a) throw notFound('That automation')
  await requireOrgPermission(db, userId, a.org_id, 'automations.manage')
  await db.query(`DELETE FROM automations WHERE id = $1`, [automationId])
  await audit(db, { actor: userId, action: 'automation.deleted', targetType: 'automation', targetId: automationId, orgId: a.org_id })
}

export async function listRuns(userId: string, orgId: string, limit = 50) {
  const db = await getDb()
  await requireOrgPermission(db, userId, orgId, 'automations.manage')
  return db.query<{ id: string; name: string; trigger: string; subject_id: string; status: string; result: unknown[]; error: string | null; created_at: Date; finished_at: Date | null }>(
    `SELECT r.id, a.name, r.trigger, r.subject_id, r.status, r.result, r.error, r.created_at, r.finished_at FROM automation_runs r JOIN automations a ON a.id = r.automation_id
      WHERE r.org_id = $1 ORDER BY r.created_at DESC LIMIT $2`, [orgId, limit])
}

/** Called by services when something happens. Never throws into the caller's flow. */
export async function fireTrigger(db: Db, orgId: string | null, trigger: Trigger, subjectId: string, ctx: Record<string, unknown>) {
  if (!orgId) return
  try {
    const autos = await db.query<{ id: string; conditions: Record<string, string> }>(`SELECT id, conditions FROM automations WHERE org_id = $1 AND trigger = $2 AND enabled`, [orgId, trigger])
    for (const a of autos) {
      if (!Object.entries(a.conditions ?? {}).every(([k, v]) => v === '' || String(ctx[k] ?? '') === v)) continue
      const runId = newId('run')
      const inserted = await db.query(`INSERT INTO automation_runs (id, automation_id, org_id, trigger, subject_id, idempotency_key) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
        [runId, a.id, orgId, trigger, subjectId, `${a.id}:${trigger}:${subjectId}`])
      if (inserted.length) await enqueue(db, 'automation.run', { runId, ctx: JSON.stringify(ctx) })
    }
  } catch (e) {
    console.error('[automations] fireTrigger failed', trigger, (e as Error).message)
  }
}

interface Subject { leadId?: string; registrationId?: string; connectionId?: string; taskId?: string; assignee?: string | null; creator?: string | null; email?: string; name?: string }

async function loadSubject(db: Db, trigger: Trigger, subjectId: string): Promise<Subject> {
  if (trigger === 'lead.created' || trigger === 'lead.stage_changed') {
    const [l] = await db.query<{ assignee_user_id: string | null; created_by: string | null; email: string; name: string; consent_at: Date | null }>(`SELECT assignee_user_id, created_by, email, name, consent_at FROM leads WHERE id = $1`, [subjectId])
    return l ? { leadId: subjectId, assignee: l.assignee_user_id, creator: l.created_by, email: l.consent_at ? l.email : '', name: l.name } : {}
  }
  if (trigger === 'registration.created' || trigger === 'checkin.created') {
    const [r] = await db.query<{ email: string; name: string; user_id: string | null }>(`SELECT email, name, user_id FROM registrations WHERE id = $1`, [subjectId])
    return r ? { registrationId: subjectId, email: r.email, name: r.name, creator: r.user_id } : {}
  }
  if (trigger === 'task.due') {
    const [t] = await db.query<{ assignee_user_id: string | null; created_by: string | null; lead_id: string | null }>(`SELECT assignee_user_id, created_by, lead_id FROM tasks WHERE id = $1`, [subjectId])
    return t ? { taskId: subjectId, assignee: t.assignee_user_id, creator: t.created_by, leadId: t.lead_id ?? undefined } : {}
  }
  if (trigger === 'connection.created') {
    const [c] = await db.query<{ owner_user_id: string }>(`SELECT owner_user_id FROM connections WHERE id = $1`, [subjectId])
    return c ? { connectionId: subjectId, creator: c.owner_user_id, assignee: c.owner_user_id } : {}
  }
  return {}
}

/** Job handler. Executes every action; a thrown error marks the run failed after the queue's retries. */
export async function executeRun(db: Db, runId: string) {
  const [run] = await db.query<{ id: string; automation_id: string; org_id: string; trigger: Trigger; subject_id: string; status: string; actions: Action[] }>(
    `SELECT r.id, r.automation_id, r.org_id, r.trigger, r.subject_id, r.status, a.actions FROM automation_runs r JOIN automations a ON a.id = r.automation_id WHERE r.id = $1`, [runId])
  if (!run || run.status === 'done') return
  const s = await loadSubject(db, run.trigger, run.subject_id)
  const results: { type: string; ok: boolean; detail?: string }[] = []
  const managers = async () => (await db.query<{ user_id: string }>(`SELECT user_id FROM memberships WHERE org_id = $1 AND role IN ('owner','admin','manager')`, [run.org_id])).map((m) => m.user_id)
  const resolveUser = async (who: string) => (who === 'assignee' ? s.assignee : who === 'creator' ? s.creator : who) ?? (await managers())[0] ?? null
  try {
    for (const a of run.actions) {
      try {
        if (a.type === 'create_task') {
          const assignee = await resolveUser(a.assignee)
          await db.query(`INSERT INTO tasks (id, org_id, lead_id, assignee_user_id, title, due_on, created_by) VALUES ($1,$2,$3,$4,$5, current_date + $6::int, NULL)`, [newId('task'), run.org_id, s.leadId ?? null, assignee, a.title, a.dueInDays])
          results.push({ type: a.type, ok: true })
        } else if (a.type === 'assign_lead') {
          if (!s.leadId) { results.push({ type: a.type, ok: false, detail: 'no lead' }); continue }
          const [m] = await db.query(`SELECT 1 FROM memberships WHERE org_id = $1 AND user_id = $2`, [run.org_id, a.userId])
          if (!m) { results.push({ type: a.type, ok: false, detail: 'assignee is not a member' }); continue }
          await db.query(`UPDATE leads SET assignee_user_id = $2, updated_at = now() WHERE id = $1 AND org_id = $3`, [s.leadId, a.userId, run.org_id])
          s.assignee = a.userId
          results.push({ type: a.type, ok: true })
        } else if (a.type === 'update_stage') {
          if (!s.leadId) { results.push({ type: a.type, ok: false, detail: 'no lead' }); continue }
          await db.query(`UPDATE leads SET stage = $2, updated_at = now() WHERE id = $1 AND org_id = $3`, [s.leadId, a.stage, run.org_id])
          results.push({ type: a.type, ok: true })
        } else if (a.type === 'notify') {
          const targets = a.to === 'managers' ? await managers() : [await resolveUser(a.to)].filter(Boolean) as string[]
          for (const u of targets) await db.query(`INSERT INTO notifications (id, user_id, kind, body, link) VALUES ($1,$2,'automation',$3,$4)`, [newId('ntf'), u, a.body, s.leadId ? `/business/leads/${s.leadId}` : '/business'])
          results.push({ type: a.type, ok: true, detail: `${targets.length} notified` })
        } else if (a.type === 'send_email') {
          let to: string | null = null, userId: string | null = null
          if (a.to === 'lead' || a.to === 'registrant') to = s.email || null
          else { userId = await resolveUser('assignee'); to = userId ? (await db.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [userId]))[0]?.email ?? null : null }
          if (!to) { results.push({ type: a.type, ok: false, detail: a.to === 'lead' ? 'no consent or no email' : 'no recipient' }); continue }
          await queueEmail(db, { to, userId, kind: 'automation', subject: a.subject, text: a.text.replace(/\{name\}/g, s.name?.split(' ')[0] ?? 'there') })
          results.push({ type: a.type, ok: true })
        } else if (a.type === 'schedule_reminder') {
          const assignee = await resolveUser('assignee')
          await db.query(`INSERT INTO tasks (id, org_id, lead_id, assignee_user_id, title, due_on) VALUES ($1,$2,$3,$4,$5, current_date + $6::int)`, [newId('task'), run.org_id, s.leadId ?? null, assignee, a.title, a.inDays])
          results.push({ type: a.type, ok: true })
        }
      } catch (e) {
        results.push({ type: a.type, ok: false, detail: String((e as Error).message).slice(0, 200) })
      }
    }
    const failed = results.some((r) => !r.ok)
    await db.query(`UPDATE automation_runs SET status = $2, result = $3::jsonb, error = $4, finished_at = now() WHERE id = $1`, [runId, failed ? 'failed' : 'done', JSON.stringify(results), failed ? 'One or more actions failed' : null])
    await track(db, 'automation_ran', { orgId: run.org_id, props: { source: run.trigger.replace('.', '_') } })
  } catch (e) {
    await db.query(`UPDATE automation_runs SET status = 'failed', error = $2, finished_at = now() WHERE id = $1`, [runId, String((e as Error).message).slice(0, 400)])
    throw e
  }
}

/** Daily sweep: tasks due today or overdue → one in-app reminder to the assignee, and the `task.due` trigger. */
export async function fireDueTasks(db: Db) {
  const due = await db.query<{ id: string; org_id: string; assignee_user_id: string | null; title: string; lead_id: string | null }>(
    `SELECT id, org_id, assignee_user_id, title, lead_id FROM tasks WHERE done_at IS NULL AND reminded_at IS NULL AND due_on <= current_date LIMIT 500`)
  for (const t of due) {
    if (t.assignee_user_id) await db.query(`INSERT INTO notifications (id, user_id, kind, body, link) VALUES ($1,$2,'task',$3,$4)`, [newId('ntf'), t.assignee_user_id, `Due: ${t.title}`, t.lead_id ? `/business/leads/${t.lead_id}` : '/business/tasks'])
    await db.query(`UPDATE tasks SET reminded_at = now() WHERE id = $1`, [t.id])
    await fireTrigger(db, t.org_id, 'task.due', t.id, { title: t.title })
  }
  return due.length
}
