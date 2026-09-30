import 'server-only'
import type { Db } from './db'
import { PlanGateError } from './errors'
import { track } from './analytics'

export type Capability =
  | 'share.link' | 'share.qr' | 'connections.basic' | 'capsules.multiple' | 'disclosure.controls'
  | 'followups' | 'notes.private' | 'branding.advanced' | 'share.nfc' | 'share.wallet' | 'history.extended'
  | 'insights.personal' | 'org.workspace' | 'org.brand' | 'org.roles' | 'events' | 'stations' | 'insights.org'
  | 'org.admin' | 'data.export.org' | 'audit.logs' | 'org.controls' | 'sso' | 'scim' | 'access.policies'
  | 'support.dedicated' | 'retention.custom' | 'security.review' | 'domains.custom' | 'api' | 'data.regional' | 'insights.viewers'

export interface Plan {
  key: string
  name: string
  rank: number
  capabilities: Capability[]
  limits: { capsules: number; historyDays: number; seats?: number }
  price_label: string | null
  active: boolean
}

export const CAPABILITY_COPY: Record<string, string> = {
  'capsules.multiple': 'More than one capsule is part of Pro.',
  'disclosure.controls': 'The “Learn more” layer is part of Pro.',
  followups: 'Follow-up reminders are part of Pro.',
  'notes.private': 'Private notes are part of Pro.',
  'share.nfc': 'NFC tag sharing is part of Pro.',
  'share.wallet': 'Wallet passes are part of Pro.',
  'insights.personal': 'Personal insights are part of Pro.',
  'insights.viewers': 'Seeing which members viewed you, and their fields, is part of Pro.',
  'org.workspace': 'Team workspaces are part of Business.',
  events: 'Event mode is part of Business.',
  stations: 'Stations and QR destinations are part of Business.',
  'audit.logs': 'Audit logs are part of Business.',
}

export async function listPlans(db: Db): Promise<Plan[]> {
  return db.query<Plan>(`SELECT key, name, rank, capabilities, limits, price_label, active FROM plan_catalog ORDER BY rank`)
}

export async function getPlan(db: Db, key: string): Promise<Plan> {
  const [p] = await db.query<Plan>(`SELECT key, name, rank, capabilities, limits, price_label, active FROM plan_catalog WHERE key = $1`, [key])
  if (p) return p
  const [free] = await db.query<Plan>(`SELECT key, name, rank, capabilities, limits, price_label, active FROM plan_catalog WHERE key = 'free'`)
  return free
}

export async function userPlan(db: Db, userId: string): Promise<Plan> {
  const [u] = await db.query<{ plan_key: string }>(`SELECT plan_key FROM users WHERE id = $1`, [userId])
  return getPlan(db, u?.plan_key ?? 'free')
}

export async function orgPlan(db: Db, orgId: string): Promise<Plan> {
  const [o] = await db.query<{ plan_key: string }>(`SELECT plan_key FROM organizations WHERE id = $1`, [orgId])
  return getPlan(db, o?.plan_key ?? 'free')
}

export function has(plan: Plan, cap: Capability) {
  return plan.capabilities.includes(cap)
}

export async function requireCapability(db: Db, plan: Plan, cap: Capability, userId: string | null) {
  if (has(plan, cap)) return
  await track(db, 'plan_gate_hit', { userId, props: { capability: cap, plan: plan.key } })
  throw new PlanGateError(cap, CAPABILITY_COPY[cap] ?? 'This is part of a higher plan.')
}
