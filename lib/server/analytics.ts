import 'server-only'
import type { Db } from './db'
import { newId } from './ids'

export type AnalyticsEvent =
  | 'signup_completed' | 'capsule_created' | 'capsule_edited' | 'share_started' | 'share_viewed'
  | 'share_expanded' | 'share_saved_vcard' | 'app_offer_shown' | 'app_offer_accepted'
  | 'connect_requested' | 'connect_accepted' | 'connect_declined' | 'note_added' | 'followup_created'
  | 'followup_completed' | 'share_revoked' | 'privacy_control_used' | 'event_created' | 'participant_added'
  | 'station_created' | 'plan_gate_hit' | 'plan_changed' | 'export_requested' | 'deletion_requested'

/**
 * Product-value analytics. user_id is always the ORYN account holder acting (or the capsule owner for
 * recipient-side events). No recipient IP, fingerprint or identity is ever stored here.
 */
export async function track(db: Db, name: AnalyticsEvent, e: { userId?: string | null; orgId?: string | null; props?: Record<string, unknown> } = {}) {
  try {
    await db.query(`INSERT INTO analytics_events (id, name, user_id, org_id, props) VALUES ($1,$2,$3,$4,$5::jsonb)`, [
      newId('ev'), name, e.userId ?? null, e.orgId ?? null, JSON.stringify(e.props ?? {}),
    ])
  } catch (err) {
    // Analytics must never break the product flow.
    console.error('[analytics] failed', name, (err as Error).message)
  }
}
