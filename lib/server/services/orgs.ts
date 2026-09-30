import 'server-only'
import { z } from 'zod'
import { getDb } from '../db'
import { newId } from '../ids'
import { AppError, invalid, notFound } from '../errors'
import { audit } from '../audit'
import { requireCapability, userPlan } from '../plans'
import { requireOrgPermission, ROLE_PERMISSIONS, type Role } from '../permissions'

export async function listMyOrgs(userId: string) {
  const db = await getDb()
  return db.query<{ id: string; name: string; slug: string; role: Role; plan_key: string; members: number }>(
    `SELECT o.id, o.name, o.slug, m.role, o.plan_key, (SELECT count(*)::int FROM memberships x WHERE x.org_id = o.id) AS members
       FROM memberships m JOIN organizations o ON o.id = m.org_id WHERE m.user_id = $1 ORDER BY o.created_at`,
    [userId],
  )
}

export async function createOrg(userId: string, name: string) {
  const clean = name.trim()
  if (clean.length < 2 || clean.length > 60) throw invalid('Use 2–60 characters for the workspace name.')
  const db = await getDb()
  await requireCapability(db, await userPlan(db, userId), 'org.workspace', userId)
  const id = newId('org')
  const slug = `${clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'team'}-${id.slice(-4).toLowerCase()}`
  await db.tx(async (t) => {
    await t.query(`INSERT INTO organizations (id, name, slug, created_by) VALUES ($1,$2,$3,$4)`, [id, clean, slug, userId])
    await t.query(`INSERT INTO memberships (org_id, user_id, role) VALUES ($1,$2,'owner')`, [id, userId])
    await t.query(`INSERT INTO subscriptions (id, subject_type, subject_id, plan_key) VALUES ($1,'organization',$2,'business')`, [newId('sub'), id])
    await audit(t, { actor: userId, action: 'org.created', targetType: 'organization', targetId: id, orgId: id })
  })
  return id
}

export async function getOrg(userId: string, orgId: string) {
  const db = await getDb()
  const role = await requireOrgPermission(db, userId, orgId, 'org.view')
  const [org] = await db.query<{ id: string; name: string; slug: string; plan_key: string; brand: Record<string, string> }>(`SELECT id, name, slug, plan_key, brand FROM organizations WHERE id = $1`, [orgId])
  const members = await db.query<{ user_id: string; display_name: string; email: string; role: Role; team_name: string | null }>(
    `SELECT m.user_id, u.display_name, u.email, m.role, t.name AS team_name FROM memberships m JOIN users u ON u.id = m.user_id LEFT JOIN teams t ON t.id = m.team_id
      WHERE m.org_id = $1 AND u.deleted_at IS NULL ORDER BY m.role, u.display_name`, [orgId])
  const teams = await db.query<{ id: string; name: string }>(`SELECT id, name FROM teams WHERE org_id = $1 ORDER BY name`, [orgId])
  return { org, role, members, teams, permissions: ROLE_PERMISSIONS[role] }
}

const memberInput = z.object({ email: z.string().trim().toLowerCase().email('Enter their email.'), role: z.enum(['admin', 'manager', 'member']) })

export async function addMember(userId: string, orgId: string, input: z.input<typeof memberInput>) {
  const r = memberInput.safeParse(input)
  if (!r.success) throw invalid(r.error.issues[0].message)
  const db = await getDb()
  const myRole = await requireOrgPermission(db, userId, orgId, 'members.manage')
  if (r.data.role === 'admin' && myRole !== 'owner') throw new AppError('forbidden', 'Only the owner can add admins.')
  const [u] = await db.query<{ id: string }>(`SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`, [r.data.email])
  // v1: members must already have an ORYN account. Email invitations need an email provider (see docs).
  if (!u) throw invalid('No ORYN account uses that email yet. Ask them to sign up first.')
  await db.query(`INSERT INTO memberships (org_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT (org_id, user_id) DO NOTHING`, [orgId, u.id, r.data.role])
  await audit(db, { actor: userId, action: 'org.member_added', targetType: 'user', targetId: u.id, orgId, meta: { role: r.data.role } })
}

export async function changeRole(userId: string, orgId: string, memberId: string, role: Role) {
  const db = await getDb()
  const myRole = await requireOrgPermission(db, userId, orgId, 'members.manage')
  if (!['admin', 'manager', 'member'].includes(role)) throw invalid('Choose a role.')
  if (memberId === userId) throw invalid('You can’t change your own role.')
  const [target] = await db.query<{ role: Role }>(`SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2`, [orgId, memberId])
  if (!target) throw notFound('That member')
  if ((target.role === 'owner' || target.role === 'admin' || role === 'admin') && myRole !== 'owner') throw new AppError('forbidden', 'Only the owner can change admins.')
  await db.query(`UPDATE memberships SET role = $3 WHERE org_id = $1 AND user_id = $2`, [orgId, memberId, role])
  await audit(db, { actor: userId, action: 'org.role_changed', targetType: 'user', targetId: memberId, orgId, meta: { from: target.role, to: role } })
}

export async function removeMember(userId: string, orgId: string, memberId: string) {
  const db = await getDb()
  const myRole = await requireOrgPermission(db, userId, orgId, 'members.manage')
  const [target] = await db.query<{ role: Role }>(`SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2`, [orgId, memberId])
  if (!target) throw notFound('That member')
  if (target.role === 'owner') throw invalid('The owner can’t be removed.')
  if (target.role === 'admin' && myRole !== 'owner') throw new AppError('forbidden', 'Only the owner can remove admins.')
  await db.tx(async (t) => {
    await t.query(`DELETE FROM memberships WHERE org_id = $1 AND user_id = $2`, [orgId, memberId])
    // Their workspace-scoped shares stop with their access.
    await t.query(`UPDATE share_sessions SET revoked_at = now() WHERE org_id = $1 AND owner_user_id = $2 AND revoked_at IS NULL`, [orgId, memberId])
    await audit(t, { actor: userId, action: 'org.member_removed', targetType: 'user', targetId: memberId, orgId })
  })
}

export async function createTeam(userId: string, orgId: string, name: string) {
  const db = await getDb()
  await requireOrgPermission(db, userId, orgId, 'members.manage')
  if (!name.trim() || name.length > 60) throw invalid('Give the team a name.')
  const id = newId('team')
  await db.query(`INSERT INTO teams (id, org_id, name) VALUES ($1,$2,$3)`, [id, orgId, name.trim()])
  await audit(db, { actor: userId, action: 'org.team_created', targetType: 'team', targetId: id, orgId })
  return id
}

export async function orgAudit(userId: string, orgId: string) {
  const db = await getDb()
  await requireOrgPermission(db, userId, orgId, 'audit.view')
  return db.query<{ id: string; action: string; target_type: string; created_at: Date; actor: string | null; meta: Record<string, unknown> }>(
    `SELECT a.id, a.action, a.target_type, a.created_at, a.meta, u.display_name AS actor FROM audit_events a LEFT JOIN users u ON u.id = a.actor_user_id
      WHERE a.org_id = $1 ORDER BY a.created_at DESC LIMIT 100`, [orgId])
}
