import 'server-only'
import { z } from 'zod'
import { getDb, type Db } from '../db'
import { newId } from '../ids'
import { invalid, notFound } from '../errors'
import { audit } from '../audit'
import { track } from '../analytics'
import { has, requireCapability, userPlan } from '../plans'
import { membership } from '../permissions'
import { FIELD_KINDS, LAYERS, MODES, MODE_TEMPLATES, INTERACTION_LEVELS, type CapsuleField, type InteractionLevel, type Mode } from '../../capsule-model'

export interface Capsule {
  id: string
  owner_user_id: string
  org_id: string | null
  name: string
  mode: Mode
  display_name: string
  headline: string
  message: string
  avatar_url: string | null
  accent: string
  fields: CapsuleField[]
  primary_action: { fieldId: string } | null
  private_note: string
  is_default: boolean
  status: 'active' | 'archived'
  version: number
  created_at: Date
  updated_at: Date
}

export interface VisibilityPolicy {
  capsule_id: string
  duration_minutes: number | null
  one_time: boolean
  interaction_level: InteractionLevel
  allow_expanded: boolean
}

const URL_KINDS = new Set(['website', 'social', 'booking', 'link'])

const fieldSchema = z
  .object({
    id: z.string().regex(/^f_[A-Za-z0-9_-]{4,24}$/),
    kind: z.enum(FIELD_KINDS),
    label: z.string().trim().max(40),
    value: z.string().trim().max(300),
    layer: z.enum(LAYERS),
  })
  .superRefine((f, ctx) => {
    if (!f.value) return
    if (URL_KINDS.has(f.kind)) {
      // Only http(s) links are ever rendered, which blocks javascript:/data: URLs.
      let ok = false
      try {
        const u = new URL(/^https?:\/\//i.test(f.value) ? f.value : `https://${f.value}`)
        ok = (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.')
      } catch {}
      if (!ok) ctx.addIssue({ code: 'custom', message: `“${f.label || f.kind}” needs to be a web address.` })
    }
    if (f.kind === 'email' && !z.string().email().safeParse(f.value).success) ctx.addIssue({ code: 'custom', message: `“${f.label || 'Email'}” needs to be an email address.` })
    if (f.kind === 'phone' && !/^[+()\d\s.-]{5,25}$/.test(f.value)) ctx.addIssue({ code: 'custom', message: `“${f.label || 'Phone'}” needs to be a phone number.` })
  })
  .transform((f) => (URL_KINDS.has(f.kind) && f.value && !/^https?:\/\//i.test(f.value) ? { ...f, value: `https://${f.value}` } : f))

const capsuleInput = z.object({
  name: z.string().trim().min(1, 'Give this capsule a name only you will see.').max(40),
  mode: z.enum(MODES),
  display_name: z.string().trim().min(1, 'Add the name people will see.').max(60),
  headline: z.string().trim().max(90).default(''),
  message: z.string().trim().max(160).default(''),
  avatar_url: z.string().trim().max(500).nullable().default(null).refine((v) => !v || /^https:\/\//.test(v) || v.startsWith('/'), 'Photo must be an https link.'),
  accent: z.enum(['blue', 'navy', 'sky', 'ink']).default('blue'),
  fields: z.array(fieldSchema).max(20).default([]),
  primary_action: z.object({ fieldId: z.string() }).nullable().default(null),
  private_note: z.string().max(2000).default(''),
})
export type CapsuleInput = z.input<typeof capsuleInput>

function parse(input: unknown) {
  const r = capsuleInput.safeParse(input)
  if (!r.success) throw invalid(r.error.issues[0].message)
  const data = r.data
  // Empty fields are dropped rather than shared as blanks.
  data.fields = data.fields.filter((f) => f.value)
  if (data.primary_action && !data.fields.some((f) => f.id === data.primary_action!.fieldId && f.layer === 'instant')) data.primary_action = null
  return data
}

export function newFieldId() {
  return newId('f', 6)
}

export function templateFields(mode: Mode): CapsuleField[] {
  return MODE_TEMPLATES[mode].map((t) => ({ id: newFieldId(), kind: t.kind, label: t.label, value: '', layer: t.layer }))
}

async function loadOwned(db: Db, userId: string, capsuleId: string): Promise<Capsule> {
  const [c] = await db.query<Capsule>(`SELECT * FROM capsules WHERE id = $1 AND owner_user_id = $2`, [capsuleId, userId])
  if (!c) throw notFound('That capsule')
  return c
}

export async function listCapsules(userId: string) {
  const db = await getDb()
  return db.query<Capsule & { active_shares: number }>(
    `SELECT c.*, (SELECT count(*)::int FROM share_sessions s WHERE s.capsule_id = c.id AND s.revoked_at IS NULL AND s.station_id IS NULL AND (s.expires_at IS NULL OR s.expires_at > now())) AS active_shares
       FROM capsules c WHERE c.owner_user_id = $1 AND c.status = 'active' ORDER BY c.is_default DESC, c.updated_at DESC`,
    [userId],
  )
}

export async function getCapsule(userId: string, capsuleId: string) {
  const db = await getDb()
  const capsule = await loadOwned(db, userId, capsuleId)
  const [policy] = await db.query<VisibilityPolicy>(`SELECT * FROM visibility_policies WHERE capsule_id = $1`, [capsuleId])
  return { capsule, policy }
}

export async function createCapsule(userId: string, input: CapsuleInput, opts: { orgId?: string | null } = {}) {
  const data = parse(input)
  const db = await getDb()
  const plan = await userPlan(db, userId)
  const [{ n }] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM capsules WHERE owner_user_id = $1 AND status = 'active'`, [userId])
  if (n >= 1) await requireCapability(db, plan, 'capsules.multiple', userId)
  if (n >= plan.limits.capsules) throw invalid(`Your plan includes up to ${plan.limits.capsules} capsules. Archive one to make room.`)
  if (!has(plan, 'disclosure.controls')) data.fields = data.fields.map((f) => (f.layer === 'expanded' ? { ...f, layer: 'instant' as const } : f))
  if (opts.orgId && !(await membership(db, userId, opts.orgId))) throw notFound('That workspace')
  const id = newId('cap')
  await db.tx(async (t) => {
    await t.query(
      `INSERT INTO capsules (id, owner_user_id, org_id, name, mode, display_name, headline, message, avatar_url, accent, fields, primary_action, private_note, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14)`,
      [id, userId, opts.orgId ?? null, data.name, data.mode, data.display_name, data.headline, data.message, data.avatar_url, data.accent, JSON.stringify(data.fields), data.primary_action ? JSON.stringify(data.primary_action) : null, data.private_note, n === 0],
    )
    const personal = data.mode === 'personal' || data.mode === 'social'
    await t.query(
      `INSERT INTO visibility_policies (capsule_id, duration_minutes, one_time, interaction_level, allow_expanded) VALUES ($1,$2,$3,$4,$5)`,
      // Personal capsules default to short-lived and ask-first; professional ones stay open until stopped.
      [id, personal ? 60 * 24 : null, false, 'connect', has(plan, 'disclosure.controls')],
    )
    await audit(t, { actor: userId, action: 'capsule.created', targetType: 'capsule', targetId: id, orgId: opts.orgId })
  })
  const [{ created_at }] = await db.query<{ created_at: Date }>(`SELECT created_at FROM users WHERE id = $1`, [userId])
  await track(db, 'capsule_created', { userId, props: { mode: data.mode, fields: data.fields.length, first: n === 0, msSinceSignup: Date.now() - new Date(created_at).getTime() } })
  return id
}

export async function updateCapsule(userId: string, capsuleId: string, input: CapsuleInput) {
  const data = parse(input)
  const db = await getDb()
  const before = await loadOwned(db, userId, capsuleId)
  const plan = await userPlan(db, userId)
  if (!has(plan, 'disclosure.controls') && data.fields.some((f) => f.layer === 'expanded')) await requireCapability(db, plan, 'disclosure.controls', userId)
  if (!has(plan, 'notes.private') && data.private_note && data.private_note !== before.private_note) await requireCapability(db, plan, 'notes.private', userId)
  await db.query(
    `UPDATE capsules SET name=$3, mode=$4, display_name=$5, headline=$6, message=$7, avatar_url=$8, accent=$9, fields=$10::jsonb, primary_action=$11::jsonb, private_note=$12,
            version = version + 1, updated_at = now()
      WHERE id = $1 AND owner_user_id = $2`,
    [capsuleId, userId, data.name, data.mode, data.display_name, data.headline, data.message, data.avatar_url, data.accent, JSON.stringify(data.fields), data.primary_action ? JSON.stringify(data.primary_action) : null, data.private_note],
  )
  const visibilityChanged = JSON.stringify(before.fields.map((f) => [f.id, f.layer])) !== JSON.stringify(data.fields.map((f) => [f.id, f.layer]))
  await audit(db, { actor: userId, action: 'capsule.updated', targetType: 'capsule', targetId: capsuleId, meta: { visibilityChanged, version: before.version + 1 } })
  await track(db, 'capsule_edited', { userId, props: { visibilityChanged } })
  if (visibilityChanged) await track(db, 'privacy_control_used', { userId, props: { control: 'field_layers' } })
}

const policyInput = z.object({
  duration_minutes: z.number().int().min(5).max(60 * 24 * 365).nullable(),
  one_time: z.boolean(),
  interaction_level: z.enum(INTERACTION_LEVELS),
  allow_expanded: z.boolean(),
})

export async function updatePolicy(userId: string, capsuleId: string, input: z.input<typeof policyInput>) {
  const r = policyInput.safeParse(input)
  if (!r.success) throw invalid(r.error.issues[0].message)
  const db = await getDb()
  await loadOwned(db, userId, capsuleId)
  const plan = await userPlan(db, userId)
  if (r.data.allow_expanded) await requireCapability(db, plan, 'disclosure.controls', userId)
  await db.query(`UPDATE visibility_policies SET duration_minutes=$2, one_time=$3, interaction_level=$4, allow_expanded=$5, updated_at=now() WHERE capsule_id=$1`, [
    capsuleId, r.data.duration_minutes, r.data.one_time, r.data.interaction_level, r.data.allow_expanded,
  ])
  await audit(db, { actor: userId, action: 'capsule.policy_updated', targetType: 'capsule', targetId: capsuleId, meta: r.data })
  await track(db, 'privacy_control_used', { userId, props: { control: 'visibility_policy' } })
}

export async function setDefaultCapsule(userId: string, capsuleId: string) {
  const db = await getDb()
  await loadOwned(db, userId, capsuleId)
  await db.tx(async (t) => {
    await t.query(`UPDATE capsules SET is_default = (id = $2) WHERE owner_user_id = $1`, [userId, capsuleId])
    await audit(t, { actor: userId, action: 'capsule.default_changed', targetType: 'capsule', targetId: capsuleId })
  })
}

export async function archiveCapsule(userId: string, capsuleId: string) {
  const db = await getDb()
  const c = await loadOwned(db, userId, capsuleId)
  await db.tx(async (t) => {
    await t.query(`UPDATE capsules SET status = 'archived', is_default = false, updated_at = now() WHERE id = $1`, [capsuleId])
    await t.query(`UPDATE share_sessions SET revoked_at = now() WHERE capsule_id = $1 AND revoked_at IS NULL AND station_id IS NULL`, [capsuleId])
    if (c.is_default) {
      await t.query(`UPDATE capsules SET is_default = true WHERE id = (SELECT id FROM capsules WHERE owner_user_id = $1 AND status='active' ORDER BY updated_at DESC LIMIT 1)`, [userId])
    }
    await audit(t, { actor: userId, action: 'capsule.archived', targetType: 'capsule', targetId: capsuleId })
  })
}

export async function defaultCapsuleId(userId: string): Promise<string | null> {
  const db = await getDb()
  const [c] = await db.query<{ id: string }>(`SELECT id FROM capsules WHERE owner_user_id = $1 AND status = 'active' ORDER BY is_default DESC, updated_at DESC LIMIT 1`, [userId])
  return c?.id ?? null
}
