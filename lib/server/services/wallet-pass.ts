import 'server-only'
import { getDb } from '../db'
import { AppError } from '../errors'
import { audit } from '../audit'
import { track } from '../analytics'
import { requireCapability, userPlan } from '../plans'
import { getCapsule, defaultCapsuleId } from './capsules'
import { startShare, shareUrl } from './sharing'
import { signShareToken } from '../tokens'
import { cardFor } from './owner-card'
import { googleConfig, googleGenericObject, googleSaveUrl, walletColors, walletStatus, type WalletCardData } from '../wallet'

/**
 * A wallet pass needs a link that keeps working: one non-expiring "wallet_pass" share of the default card,
 * reused across passes and stoppable like any other share (stopping it makes the pass open "no longer shared").
 */
export async function walletLink(userId: string) {
  const db = await getDb()
  await requireCapability(db, await userPlan(db, userId), 'share.wallet', userId)
  const capsuleId = await defaultCapsuleId(userId)
  if (!capsuleId) throw new AppError('not_found', 'Create your card first.')
  // One permanent link per person. It follows whichever card is active, so the pass never has to be reissued.
  const [s] = await db.query<{ id: string }>(
    `SELECT id FROM share_sessions WHERE owner_user_id = $1 AND channel = 'wallet_pass' AND follow_default AND revoked_at IS NULL AND expires_at IS NULL ORDER BY created_at DESC LIMIT 1`, [userId])
  if (s) return { shareId: s.id, url: shareUrl(signShareToken(s.id, null)), capsuleId }
  const created = await startShare(userId, { capsuleId, channel: 'wallet_pass', durationMinutes: null, oneTime: false, contextLabel: 'Wallet pass' })
  await db.query(`UPDATE share_sessions SET follow_default = TRUE, one_time = FALSE WHERE id = $1`, [created.id])
  return { shareId: created.id, url: created.url, capsuleId }
}

export async function walletCardData(userId: string, capsuleId: string, url: string): Promise<WalletCardData> {
  const { capsule } = await getCapsule(userId, capsuleId)
  const { design, identity } = cardFor(capsule)
  return { name: identity.displayName, headline: identity.headline, company: identity.company, url, colors: walletColors(design) }
}

/** "Add to Google Wallet": a signed save link, or a clear integration-required error. Never a fake success. */
export async function googleWalletSaveLink(userId: string, origin: string) {
  const db0 = await getDb()
  if (!walletStatus().google.configured) {
    await track(db0, 'wallet_add_failed', { userId, props: { platform: 'google', source: 'not_configured' } })
    throw new AppError('conflict', 'Google Wallet isn’t connected on this ORYN server yet.')
  }
  await track(db0, 'wallet_add_started', { userId, props: { platform: 'google' } })
  const link = await walletLink(userId)
  const data = await walletCardData(userId, link.capsuleId, link.url.startsWith('http') ? link.url : `${origin}${link.url}`)
  const cfg = googleConfig()
  const url = googleSaveUrl(googleGenericObject(data, { issuerId: cfg.issuerId, objectSuffix: link.shareId }), { serviceAccountEmail: cfg.serviceAccountEmail, privateKeyPem: cfg.privateKeyPem, origin })
  const db = await getDb()
  await audit(db, { actor: userId, action: 'wallet.pass_issued', targetType: 'share_session', targetId: link.shareId, meta: { platform: 'google' } })
  return url
}
