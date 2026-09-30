import 'server-only'
import type { Db } from './db'
import { AppError, notFound } from './errors'

export type Role = 'owner' | 'admin' | 'manager' | 'member'
export type Permission =
  | 'org.view' | 'org.manage' | 'org.billing' | 'members.view' | 'members.manage'
  | 'events.view' | 'events.manage' | 'participants.manage' | 'stations.view' | 'stations.manage'
  | 'audit.view' | 'insights.view' | 'data.export'

/** The Permission entity: role -> permissions. Kept in code so it is reviewed like code. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ['org.view', 'org.manage', 'org.billing', 'members.view', 'members.manage', 'events.view', 'events.manage', 'participants.manage', 'stations.view', 'stations.manage', 'audit.view', 'insights.view', 'data.export'],
  admin: ['org.view', 'org.manage', 'members.view', 'members.manage', 'events.view', 'events.manage', 'participants.manage', 'stations.view', 'stations.manage', 'audit.view', 'insights.view', 'data.export'],
  manager: ['org.view', 'members.view', 'events.view', 'events.manage', 'participants.manage', 'stations.view', 'stations.manage', 'insights.view'],
  member: ['org.view', 'members.view', 'events.view', 'stations.view'],
}

export async function membership(db: Db, userId: string, orgId: string): Promise<{ role: Role } | null> {
  const [m] = await db.query<{ role: Role }>(`SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2`, [orgId, userId])
  return m ?? null
}

/**
 * Server-side authorization for every organization action. Non-members get "not found" so the
 * existence of another tenant's resources is never revealed.
 */
export async function requireOrgPermission(db: Db, userId: string, orgId: string, perm: Permission): Promise<Role> {
  const m = await membership(db, userId, orgId)
  if (!m) throw notFound('That workspace')
  if (!ROLE_PERMISSIONS[m.role].includes(perm)) throw new AppError('forbidden', 'Your role in this workspace can’t do that.')
  return m.role
}

export async function requirePlatformAdmin(db: Db, userId: string) {
  const [u] = await db.query<{ is_platform_admin: boolean }>(`SELECT is_platform_admin FROM users WHERE id = $1 AND deleted_at IS NULL`, [userId])
  if (!u?.is_platform_admin) throw notFound('That page')
}
