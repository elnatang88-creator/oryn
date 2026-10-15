import 'server-only'
import type { Db } from './db'
import { newId } from './ids'

/** Append-only audit trail for access, permission, sharing and data-lifecycle changes. */
export async function audit(
  db: Db,
  e: { actor: string | null; action: string; targetType: string; targetId?: string | null; orgId?: string | null; meta?: Record<string, unknown> },
) {
  await db.query(
    `INSERT INTO audit_events (id, actor_user_id, org_id, action, target_type, target_id, meta) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [newId('aud'), e.actor, e.orgId ?? null, e.action, e.targetType, e.targetId ?? null, JSON.stringify(e.meta ?? {})],
  )
}
