import Link from 'next/link'
import { Logo } from './Logo'

export function RecipientFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-soft-100 to-soft-50">
      <main id="main" className="mx-auto max-w-md px-4 pb-16 pt-5">
        {children}
        <p className="mt-10 text-center text-xs text-ink-muted">
          <Logo height={18} className="mx-auto mb-2" />
          You don’t need an account to view this. <Link href="/privacy" className="underline">How ORYN handles privacy</Link>
        </p>
      </main>
    </div>
  )
}

export function Unavailable({ status }: { status: string }) {
  const copy: Record<string, [string, string]> = {
    revoked: ['This capsule is no longer shared', 'The person who shared it has closed it.'],
    expired: ['This capsule has closed', 'It was shared for a limited time.'],
    claimed: ['This capsule was already opened', 'It was set to open for one person only.'],
    restricted: ['This capsule is for someone else', 'It was shared with a specific person.'],
    paused: ['This station is resting', 'Please ask someone nearby.'],
    not_found: ['This link doesn’t open a capsule', 'It may be mistyped, or it no longer exists.'],
  }
  const [title, body] = copy[status] ?? copy.not_found
  return (
    <RecipientFrame>
      <div className="mt-16 rounded-capsule bg-white p-8 text-center shadow-lift" data-testid="recipient-unavailable" data-status={status}>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-soft-100">
          <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="#86AAFF" strokeWidth="3" strokeDasharray="4 3" /></svg>
        </div>
        <h1 className="mt-4 text-xl font-bold text-navy-900">{title}</h1>
        <p className="mt-1 text-ink-muted">{body}</p>
      </div>
    </RecipientFrame>
  )
}

const BOT = /bot|crawl|spider|preview|facebookexternalhit|slack|whatsapp|telegram|discord|twitter|linkedin|embedly|skype|inspectiontool|headlesschrome\/.*lighthouse/i
export const isBot = (ua: string) => BOT.test(ua)
