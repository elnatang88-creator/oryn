import { redirect } from 'next/navigation'
import { getDb } from '@/lib/server/db'
import { signShareToken } from '@/lib/server/tokens'
import { startShare } from '@/lib/server/services/sharing'
import { defaultCapsuleId } from '@/lib/server/services/capsules'
import { Unavailable } from '@/components/Recipient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'ORYN', robots: { index: false, follow: false } }

/**
 * Public identity: oryn/u/<username> always shows the person's current active card through one permanent,
 * revocable link (same mechanism as the Wallet pass). Stop that link and the address goes dark.
 */
export default async function PublicIdentity({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  if (!/^[a-z0-9-]{3,30}$/.test(username)) return <Unavailable status="not_found" />
  const db = await getDb()
  const [u] = await db.query<{ id: string }>(`SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL`, [username])
  if (!u) return <Unavailable status="not_found" />
  let [s] = await db.query<{ id: string }>(`SELECT id FROM share_sessions WHERE owner_user_id = $1 AND channel = 'link' AND follow_default AND revoked_at IS NULL AND expires_at IS NULL ORDER BY created_at DESC LIMIT 1`, [u.id])
  if (!s) {
    const [revoked] = await db.query(`SELECT 1 FROM share_sessions WHERE owner_user_id = $1 AND channel = 'link' AND follow_default AND revoked_at IS NOT NULL`, [u.id])
    if (revoked) return <Unavailable status="revoked" />
    const capsuleId = await defaultCapsuleId(u.id)
    if (!capsuleId) return <Unavailable status="not_found" />
    const created = await startShare(u.id, { capsuleId, channel: 'link', durationMinutes: null, oneTime: false, contextLabel: 'Public address' })
    await db.query(`UPDATE share_sessions SET follow_default = TRUE, one_time = FALSE WHERE id = $1`, [created.id])
    s = { id: created.id }
  }
  redirect(`/c/${signShareToken(s.id, null)}`)
}
