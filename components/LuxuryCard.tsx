import type { CSSProperties, ReactNode } from 'react'
import { designVars, initials, type CardDesign } from '@/lib/card-design'

export interface CardIdentity {
  displayName: string
  headline: string
  company: string | null
  avatarUrl: string | null
}

/**
 * The ORYN card face. Pure markup + CSS variables from the design system, so it renders on the server
 * (recipient page loads fast, works without JavaScript) and in the editor's live preview alike.
 */
export function CardFace({ design, identity, nameTestId }: { design: CardDesign; identity: CardIdentity; nameTestId?: string }) {
  const { displayName, headline, company, avatarUrl } = identity
  const name = (size: string) => (
    <div className="lc-name lc-foil" dir="auto" style={{ '--name-size': size } as CSSProperties} data-testid={nameTestId}>{displayName || ' '}</div>
  )
  const sub = headline ? <div className="lc-title" dir="auto">{headline}</div> : null
  let body: ReactNode
  if (design.layout === 'monogram') {
    body = (
      <div className="lc-face lc-l-monogram">
        <div className="lc-mark" aria-hidden="true" />
        <div className="lc-mono lc-foil" dir="auto" aria-hidden="true">{initials(displayName)}</div>
        <div className="lc-rule" style={{ width: '14cqw' }} />
        {name('5.4cqw')}
        {(headline || company) && <div className="lc-title" dir="auto">{[headline, company].filter(Boolean).join(' · ')}</div>}
      </div>
    )
  } else if (design.layout === 'signature') {
    body = (
      <div className="lc-face lc-l-signature">
        <div className="lc-top"><div className="lc-company lc-foil" dir="auto">{company ?? ''}</div><div className="lc-mark" aria-hidden="true" /></div>
        <div className="lc-bottom">{name('8.2cqw')}<div className="lc-rule" style={{ width: '22cqw' }} />{sub}</div>
      </div>
    )
  } else if (design.layout === 'minimal') {
    body = (
      <div className="lc-face lc-l-minimal">
        {name('8.6cqw')}<div className="lc-rule" style={{ width: '18cqw' }} />{sub}<div className="lc-mark" aria-hidden="true" />
      </div>
    )
  } else {
    body = (
      <div className="lc-face lc-l-photo">
        <div className="lc-mark" aria-hidden="true" />
        {avatarUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="lc-photo" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
          : <div className="lc-photo lc-photo-initials" aria-hidden="true">{initials(displayName)}</div>}
        <div className="lc-who">{name('7cqw')}{sub}{company && <div className="lc-company lc-foil" dir="auto">{company}</div>}</div>
      </div>
    )
  }
  return (
    <div className="lc-holder">
      <div className={`lc-card lc-finish-${design.finish}`} style={designVars(design) as CSSProperties} data-material={design.material} data-testid="luxury-card">
        <div className="lc-texture" /><div className="lc-holo" /><div className="lc-sheen" /><div className="lc-edge" />
        {body}
      </div>
    </div>
  )
}

/** The back of the card: a QR code framed in the card's foil. */
export function CardBack({ design, qrSvg, caption, qrTestId }: { design: CardDesign; qrSvg: string; caption: string; qrTestId?: string }) {
  return (
    <div className="lc-holder">
    <div className={`lc-card lc-finish-${design.finish}`} style={designVars(design) as CSSProperties} data-material={design.material}>
      <div className="lc-texture" /><div className="lc-holo" /><div className="lc-sheen" /><div className="lc-edge" />
      <div className="lc-back">
        <div className="lc-qr" data-testid={qrTestId} role="img" aria-label="QR code for this capsule" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="lc-back-text"><div className="lc-hint lc-foil" dir="auto">{caption}</div><div className="lc-mark" aria-hidden="true" /></div>
      </div>
    </div>
    </div>
  )
}
