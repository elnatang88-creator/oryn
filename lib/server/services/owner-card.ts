import 'server-only'
import QRCode from 'qrcode'
import { normalizeDesign, type CardDesign } from '../../card-design'
import type { CardIdentity, CardDetail } from '../../../components/LuxuryCard'
import type { Capsule } from './capsules'

/**
 * The single source for how a capsule looks as a card. Card Studio, Share, Present, QR mode, Nearby and the
 * Wallet preview all go through here, so an edit in Card Studio shows up everywhere at once.
 * Only first-layer ("instant") details can be printed on the card itself.
 */
export function cardFor(capsule: Pick<Capsule, 'design' | 'display_name' | 'headline' | 'avatar_url' | 'fields'>): { design: CardDesign; identity: CardIdentity; details: CardDetail[] } {
  const company = capsule.fields.find((f) => f.kind === 'company' && f.layer === 'instant' && f.value)?.value ?? null
  // The back shows what anyone given this card sees first (the first layer) — never Learn-more or hidden details.
  const details = capsule.fields.filter((f) => f.layer === 'instant' && f.value).map(({ kind, label, value }) => ({ kind, label, value }))
  return { design: normalizeDesign(capsule.design), identity: { displayName: capsule.display_name, headline: capsule.headline, company, avatarUrl: capsule.avatar_url }, details }
}

export function qrSvg(url: string) {
  return QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0B1024', light: '#FFFFFF' } })
}
