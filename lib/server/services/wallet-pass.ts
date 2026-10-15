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
import { appleConfig, applePassJson, googleConfig, googleGenericObject, googleSaveUrl, walletColors, walletStatus, type WalletCardData } from '../wallet'
import { buildPkpass } from '../wallet-pkpass'

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

/** The person's permanent pass link, if one exists — read-only (the Wallet Center shows it without creating one). */
export async function walletPassState(userId: string) {
  const db = await getDb()
  const [s] = await db.query<{ id: string; created_at: Date; view_count: number }>(
    `SELECT id, created_at, view_count FROM share_sessions WHERE owner_user_id = $1 AND channel = 'wallet_pass' AND follow_default AND revoked_at IS NULL AND expires_at IS NULL ORDER BY created_at DESC LIMIT 1`, [userId])
  if (!s) return null
  const [issued] = await db.query<{ apple: number; google: number; last_at: Date | null }>(
    `SELECT count(*) FILTER (WHERE meta->>'platform' = 'apple')::int AS apple, count(*) FILTER (WHERE meta->>'platform' = 'google')::int AS google, max(created_at) AS last_at
       FROM audit_events WHERE action = 'wallet.pass_issued' AND target_id = $1`, [s.id])
  return { shareId: s.id, url: shareUrl(signShareToken(s.id, null)), createdAt: s.created_at, opens: s.view_count, issued }
}

/** Whether the unsigned Apple preview may be built here: development, or ORYN_WALLET_PREVIEW=true on purpose. */
export function applePreviewAllowed() {
  return process.env.NODE_ENV !== 'production' || process.env.ORYN_WALLET_PREVIEW === 'true'
}

/**
 * "Add to Apple Wallet": a signed .pkpass, or a clear integration-required error. With `preview`, an UNSIGNED
 * archive for developers (never when signing is possible, never in production unless enabled) — it will not
 * install on a device and is labelled as such in its filename and pass description.
 */
export async function appleWalletPass(userId: string, origin: string, opts: { preview?: boolean } = {}) {
  const db = await getDb()
  const configured = walletStatus().apple.configured
  const preview = !!opts.preview && !configured
  if (!configured && !preview) {
    await track(db, 'wallet_add_failed', { userId, props: { platform: 'apple', source: 'not_configured' } })
    throw new AppError('conflict', 'Apple Wallet isn’t connected on this ORYN server yet.')
  }
  if (preview && !applePreviewAllowed()) throw new AppError('forbidden', 'Pass previews are off on this server.')
  await track(db, preview ? 'wallet_preview_built' : 'wallet_add_started', { userId, props: { platform: 'apple' } })
  const link = await walletLink(userId)
  const data = await walletCardData(userId, link.capsuleId, link.url.startsWith('http') ? link.url : `${origin}${link.url}`)
  const cfg = appleConfig()
  const json = applePassJson(data, { serial: link.shareId, passTypeId: cfg.passTypeId || 'pass.preview.unsigned', teamId: cfg.teamId || 'PREVIEW' }) as Record<string, unknown>
  if (preview) json.description = `UNSIGNED PREVIEW — ${String(json.description ?? 'ORYN card')}`
  const built = await buildPkpass(json)
  if (!preview && !built.signed) throw new AppError('conflict', 'The pass could not be signed.')
  await audit(db, { actor: userId, action: preview ? 'wallet.preview_built' : 'wallet.pass_issued', targetType: 'share_session', targetId: link.shareId, meta: { platform: 'apple', signed: built.signed } })
  return { ...built, serial: link.shareId }
}
