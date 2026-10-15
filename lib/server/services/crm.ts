import 'server-only'
import { z } from 'zod'
import { getDb } from '../db'
import { newId } from '../ids'
import { AppError, invalid, notFound } from '../errors'
import { audit } from '../audit'
import { track } from '../analytics'
import { rateLimit } from '../ratelimit'
import { requireOrgPermission } from '../permissions'
import { fireTrigger } from './automations'
import { toCsv } from './registrations'

/**
 * Workspace CRM: leads captured at stations, booths, forms, registrations or by hand; stages per workspace;
 * notes, tasks, assignment, export. Everything is scoped to the workspace and checked server-side.
 * A lead's contact details exist because the person gave them with consent (`consent_at`).
 */
export interface Lead {
  id: string; org_id: string; event_id: string | null; station_id: string | null; source: string; name: string; email: string; phone: string; company: string; message: string
  consent_at: Date | null; stage: string; assignee_user_id: string | null; tags: string[]; created_by: string | null; created_at: Date; updated_at: Date
}

export const DEFAULT_STAGES = ['New', 'Contacted', 'Qualified', 'Meeting Scheduled', 'Proposal', 'Won', 'Lost']

export async function pipelineStages(orgId: string) {
  const db = await getDb()
  const [o] = await db.query<{ pipeline_stages: string[] }>(`SELECT pipeline_stages FROM organizations WHERE id = $1`, [orgId])
  return o?.pipeline_stages?.length ? o.pipeline_stages : DEFAULT_STAGES
}

export async function setPipelineStages(userId: string, orgId: string, stages: string[]) {
  const clean = [...new Set(stages.map((s) => s.trim()).filter(Boolean))].slice(0, 12)
  if (clean.length < 2 || clean.some((s) => s.length > 40)) throw invalid('Give 2–12 stages, each under 40 characters.')
  const db = await getDb()
  await requireOrgPermission(db, userId, orgId, 'org.manage')
  await db.query(`UPDATE organizations SET pipeline_stages = $2::jsonb WHERE id = $1`, [orgId, JSON.stringify(clean)])
  await audit(db, { actor: userId, action: 'org.pipeline_changed', targetType: 'organization', targetId: orgId, orgId })
  return clean
}

const leadInput = z.object({
  name: z.string().trim().min(2, 'Add a name.').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email.').max(254).or(z.literal('')).default(''),
  phone: z.string().trim().max(40).default(''),
  company: z.string().trim().max(80).default(''),
  message: z.string().trim().max(2000).default(''),
  consent: z.boolean().default(false),
  eventId: z.string().max(40).nullable().optional(),
  stationId: z.string().max(40).nullable().optional(),
  source: z.enum(['station', 'form', 'manual', 'registration', 'booth']).default('manual'),
})

/** Public capture (station / booth form): consent is mandatory. Internal creation: the member vouches. */
export async function createLead(orgId: string, input: z.input<typeof leadInput>, ctx: { userId?: string | null; ipKey?: string }) {
  const r = leadInput.safeParse(input)
  if (!r.success) throw invalid(r.error.issues[0].message)
  const db = await getDb()
  if (ctx.userId) await requireOrgPermission(db, ctx.userId, orgId, 'leads.manage')
  else {
    if (!r.data.consent) throw invalid('Please agree to be contacted.')
    if (!r.data.email && !r.data.phone) throw invalid('Leave an email or a phone number so they can reach you.')
    await rateLimit(db, `lead:${ctx.ipKey ?? 'anon'}`, 40, 3600)
  }
  const id = newId('lead')
  const [stage] = await pipelineStages(orgId)
  await db.query(
    `INSERT INTO leads (id, org_id, event_id, station_id, source, name, email, phone, company, message, consent_at, stage, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, CASE WHEN $11 THEN now() END, $12, $13)`,
    [id, orgId, r.data.eventId ?? null, r.data.stationId ?? null, r.data.source, r.data.name, r.data.email, r.data.phone, r.data.company, r.data.message, r.data.consent || !!ctx.userId, stage, ctx.userId ?? null],
  )
  if (r.data.stationId) await db.query(`INSERT INTO station_interactions (id, station_id, org_id, kind) VALUES ($1,$2,$3,'lead')`, [newId('si'), r.data.stationId, orgId])
  await audit(db, { actor: ctx.userId ?? null, action: 'lead.created', targetType: 'lead', targetId: id, orgId, meta: { source: r.data.source } })
  await track(db, 'lead_created', { userId: ctx.userId ?? null, orgId, props: { source: r.data.source, context_id: r.data.eventId ?? undefined } })
  await fireTrigger(db, orgId, 'lead.created', id, { source: r.data.source, stage, eventId: r.data.eventId ?? '' })
  return id
}

export async function listLeads(userId: string, orgId: string, f: { stage?: string; q?: string; assignee?: string; eventId?: string } = {}) {
  const db = await getDb()
  await requireOrgPermission(db, userId, orgId, 'leads.view')
  return db.query<Lead & { assignee_name: string | null; event_name: string | null; station_name: string | null; open_tasks: number }>(
    `SELECT l.*, u.display_name AS assignee_name, e.name AS event_name, s.name AS station_name,
            (SELECT count(*)::int FROM tasks t WHERE t.lead_id = l.id AND t.done_at IS NULL) AS open_tasks
       FROM leads l LEFT JOIN users u ON u.id = l.assignee_user_id LEFT JOIN events e ON e.id = l.event_id LEFT JOIN stations s ON s.id = l.station_id
      WHERE l.org_id = $1 AND ($2 = '' OR l.stage = $2) AND ($3 = '' OR l.assignee_user_id = $3) AND ($5 = '' OR l.event_id = $5)
        AND ($4 = '' OR l.name ILIKE '%' || $4 || '%' OR l.company ILIKE '%' || $4 || '%' OR l.email ILIKE '%' || $4 || '%' OR array_to_string(l.tags, ' ') ILIKE '%' || $4 || '%')
      ORDER BY l.updated_at DESC LIMIT 500`,
    [orgId, f.stage ?? '', f.assignee ?? '', (f.q ?? '').slice(0, 60), f.eventId ?? ''],
  )
}

export async function getLead(userId: string, leadId: string) {
  const db = await getDb()
  const [l] = await db.query<Lead & { assignee_name: string | null; event_name: string | null; station_name: string | null }>(
    `SELECT l.*, u.display_name AS assignee_name, e.name AS event_name, s.name AS station_name FROM leads l LEFT JOIN users u ON u.id = l.assignee_user_id LEFT JOIN events e ON e.id = l.event_id LEFT JOIN stations s ON s.id = l.station_id WHERE l.id = $1`, [leadId])
  if (!l) throw notFound('That lead')
  await requireOrgPermission(db, userId, l.org_id, 'leads.view')
  const notes = await db.query<{ id: string; body: string; created_at: Date; author: string | null }>(`SELECT n.id, n.body, n.created_at, u.display_name AS author FROM lead_notes n LEFT JOIN users u ON u.id = n.author_user_id WHERE n.lead_id = $1 ORDER BY n.created_at DESC`, [leadId])
  const tasks = await db.query<{ id: string; title: string; due_on: string | null; done_at: Date | null; assignee: string | null }>(`SELECT t.id, t.title, t.due_on::text, t.done_at, u.display_name AS assignee FROM tasks t LEFT JOIN users u ON u.id = t.assignee_user_id WHERE t.lead_id = $1 ORDER BY t.done_at NULLS FIRST, t.due_on`, [leadId])
  const members = await db.query<{ id: string; name: string }>(`SELECT u.id, u.display_name AS name FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = $1 ORDER BY u.display_name`, [l.org_id])
  return { lead: l, notes, tasks, members, stages: await pipelineStages(l.org_id) }
}

export async function updateLead(userId: string, leadId: string, patch: { stage?: string; assigneeUserId?: string | null; tags?: string[]; name?: string; company?: string; email?: string; phone?: string }) {
  const db = await getDb()
  const [l] = await db.query<{ org_id: string; stage: string }>(`SELECT org_id, stage FROM leads WHERE id = $1`, [leadId])
  if (!l) throw notFound('That lead')
  await requireOrgPermission(db, userId, l.org_id, 'leads.manage')
  if (patch.stage !== undefined && !(await pipelineStages(l.org_id)).includes(patch.stage)) throw invalid('That stage isn’t in this pipeline.')
  if (patch.assigneeUserId) {
    const [m] = await db.query(`SELECT 1 FROM memberships WHERE org_id = $1 AND user_id = $2`, [l.org_id, patch.assigneeUserId])
    if (!m) throw new AppError('forbidden', 'Leads can only be assigned to workspace members.')
  }
  const tags = patch.tags ? [...new Set(patch.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 10) : undefined
  await db.query(
    `UPDATE leads SET stage = coalesce($2, stage), assignee_user_id = CASE WHEN $3::boolean THEN $4 ELSE assignee_user_id END, tags = coalesce($5, tags),
            name = coalesce($6, name), company = coalesce($7, company), email = coalesce($8, email), phone = coalesce($9, phone), updated_at = now() WHERE id = $1`,
    [leadId, patch.stage ?? null, patch.assigneeUserId !== undefined, patch.assigneeUserId ?? null, tags ?? null, patch.name ?? null, patch.company ?? null, patch.email?.toLowerCase() ?? null, patch.phone ?? null],
  )
  await audit(db, { actor: userId, action: 'lead.updated', targetType: 'lead', targetId: leadId, orgId: l.org_id, meta: { stage: patch.stage, assigned: patch.assigneeUserId !== undefined } })
  if (patch.stage && patch.stage !== l.stage) {
    await track(db, 'lead_stage_changed', { userId, orgId: l.org_id, props: { source: patch.stage.toLowerCase().replace(/\W+/g, '_').slice(0, 32) } })
    await fireTrigger(db, l.org_id, 'lead.stage_changed', `${leadId}:${patch.stage}`, { stage: patch.stage, leadId })
  }
  if (patch.assigneeUserId && patch.assigneeUserId !== userId) {
    await db.query(`INSERT INTO notifications (id, user_id, kind, body, link) VALUES ($1,$2,'lead_assigned',$3,$4)`, [newId('ntf'), patch.assigneeUserId, 'A lead was assigned to you.', `/business/leads/${leadId}`])
  }
}

export async function addLeadNote(userId: string, leadId: string, body: string) {
  const text = body.trim()
  if (!text || text.length > 4000) throw invalid('Write a note under 4000 characters.')
  const db = await getDb()
  const [l] = await db.query<{ org_id: string }>(`SELECT org_id FROM leads WHERE id = $1`, [leadId])
  if (!l) throw notFound('That lead')
  await requireOrgPermission(db, userId, l.org_id, 'leads.manage')
  const id = newId('ln')
  await db.query(`INSERT INTO lead_notes (id, lead_id, org_id, author_user_id, body) VALUES ($1,$2,$3,$4,$5)`, [id, leadId, l.org_id, userId, text])
  await db.query(`UPDATE leads SET updated_at = now() WHERE id = $1`, [leadId])
  return id
}

export async function createTask(userId: string, orgId: string, input: { title: string; dueOn?: string | null; leadId?: string | null; assigneeUserId?: string | null }) {
  const title = input.title.trim()
  if (!title || title.length > 120) throw invalid('Give the task a short title.')
  if (input.dueOn && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueOn)) throw invalid('Check the date.')
  const db = await getDb()
  await requireOrgPermission(db, userId, orgId, 'leads.manage')
  if (input.leadId) {
    const [l] = await db.query(`SELECT 1 FROM leads WHERE id = $1 AND org_id = $2`, [input.leadId, orgId])
    if (!l) throw notFound('That lead')
  }
  const id = newId('task')
  await db.query(`INSERT INTO tasks (id, org_id, lead_id, assignee_user_id, title, due_on, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, orgId, input.leadId ?? null, input.assigneeUserId ?? userId, title, input.dueOn ?? null, userId])
  return id
}

export async function setTaskDone(userId: string, taskId: string, done: boolean) {
  const db = await getDb()
  const [t] = await db.query<{ org_id: string }>(`SELECT org_id FROM tasks WHERE id = $1`, [taskId])
  if (!t) throw notFound('That task')
  await requireOrgPermission(db, userId, t.org_id, 'leads.manage')
  await db.query(`UPDATE tasks SET done_at = CASE WHEN $2 THEN now() ELSE NULL END WHERE id = $1`, [taskId, done])
}

export async function listTasks(userId: string, orgId: string, onlyMine = false) {
  const db = await getDb()
  await requireOrgPermission(db, userId, orgId, 'leads.view')
  return db.query<{ id: string; title: string; due_on: string | null; done_at: Date | null; lead_id: string | null; lead_name: string | null; assignee: string | null; overdue: boolean }>(
    `SELECT t.id, t.title, t.due_on::text, t.done_at, t.lead_id, l.name AS lead_name, u.display_name AS assignee, (t.due_on < current_date AND t.done_at IS NULL) AS overdue
       FROM tasks t LEFT JOIN leads l ON l.id = t.lead_id LEFT JOIN users u ON u.id = t.assignee_user_id
      WHERE t.org_id = $1 AND ($2 = '' OR t.assignee_user_id = $2) ORDER BY t.done_at NULLS FIRST, t.due_on NULLS LAST, t.created_at DESC LIMIT 300`, [orgId, onlyMine ? userId : ''])
}

export async function exportLeadsCsv(userId: string, orgId: string) {
  const db = await getDb()
  await requireOrgPermission(db, userId, orgId, 'data.export')
  const rows = await db.query<Record<string, unknown>>(`SELECT l.name, l.company, l.email, l.phone, l.stage, u.display_name AS assignee, l.source, e.name AS event, array_to_string(l.tags, ';') AS tags, l.created_at FROM leads l LEFT JOIN users u ON u.id = l.assignee_user_id LEFT JOIN events e ON e.id = l.event_id WHERE l.org_id = $1 ORDER BY l.created_at DESC`, [orgId])
  await audit(db, { actor: userId, action: 'leads.exported', targetType: 'organization', targetId: orgId, orgId, meta: { rows: rows.length } })
  return toCsv(rows, ['name', 'company', 'email', 'phone', 'stage', 'assignee', 'source', 'event', 'tags', 'created_at'])
}

export async function pipelineSummary(userId: string, orgId: string) {
  const db = await getDb()
  await requireOrgPermission(db, userId, orgId, 'leads.view')
  const stages = await pipelineStages(orgId)
  const counts = await db.query<{ stage: string; n: number }>(`SELECT stage, count(*)::int AS n FROM leads WHERE org_id = $1 GROUP BY stage`, [orgId])
  const [t] = await db.query<{ open: number; overdue: number; mine: number }>(`SELECT count(*) FILTER (WHERE done_at IS NULL)::int AS open, count(*) FILTER (WHERE done_at IS NULL AND due_on < current_date)::int AS overdue, count(*) FILTER (WHERE done_at IS NULL AND assignee_user_id = $2)::int AS mine FROM tasks WHERE org_id = $1`, [orgId, userId])
  return { stages: stages.map((s) => ({ stage: s, n: counts.find((c) => c.stage === s)?.n ?? 0 })), tasks: t }
}
