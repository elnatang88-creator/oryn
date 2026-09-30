import Link from 'next/link'
import { headers } from 'next/headers'
import { ArrowDownToLine, ChevronRight, UserPlus } from 'lucide-react'
import { resolveShare } from '@/lib/server/services/sharing'
import { currentUser, readClaim } from '@/lib/server/request'
import { recordMemberView } from '@/lib/server/services/viewers'
import { ViewerNotice } from '@/components/ViewerNotice'
import { TapTracker } from '@/components/TapTracker'
import { openOnceAction, reportAction } from '@/app/actions/recipient'
import { CapsuleView } from '@/components/CapsuleView'
import { RecipientFrame, Unavailable, isBot } from '@/components/Recipient'
import { ActionForm, Submit } from '@/components/Forms'

export const dynamic = 'force-dynamic'
// Link previews never show who shared it or what's inside.
export const metadata = { title: 'A capsule shared with you', robots: { index: false, follow: false }, openGraph: { title: 'A capsule was shared with you', description: 'Open it to see what they chose to share.' } }

/** Layer 1 — Instant View. No account, no app, nothing asked of the recipient. */
export default async function InstantView({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const claim = await readClaim()
  const peek = await resolveShare(token, { claimToken: claim })
  if (peek.status === 'needs_open') {
    return (
      <RecipientFrame>
        <div className="mt-16 rounded-capsule bg-navy-900 p-8 text-center text-white shadow-capsule" data-testid="open-once">
          <p className="text-sm font-semibold text-soft-300">A capsule for you</p>
          <h1 className="mt-2 text-2xl font-bold">{peek.displayName} shared something with you</h1>
          <p className="mt-2 text-soft-200">It opens once, on this device only.</p>
          <form action={openOnceAction} className="mt-6">
            <input type="hidden" name="token" value={token} />
            <button className="btn-share w-full">Open it</button>
          </form>
        </div>
      </RecipientFrame>
    )
  }
  if (peek.status !== 'ok') return <Unavailable status={peek.status} />

  const ua = (await headers()).get('user-agent') ?? ''
  const res = isBot(ua) ? peek : await resolveShare(token, { claimToken: claim, record: true })
  if (res.status !== 'ok') return <Unavailable status={res.status} />
  const { view } = res
  const first = view.displayName.split(' ')[0]
  const me = await currentUser()
  const member = me && me.id !== res.session.owner_user_id ? me : null
  if (member && !isBot(ua)) await recordMemberView({ capsuleId: res.session.capsule_id, ownerId: res.session.owner_user_id, viewerId: member.id, shareSessionId: res.session.id, expanded: false })

  return (
    <RecipientFrame>
      <TapTracker token={token} />
      {member && <ViewerNotice viewerName={member.display_name} ownerFirst={first} visible={member.view_visibility === 'visible'} />}
      <div className="animate-rise"><CapsuleView view={view} /></div>
      <div className="mt-5 space-y-2.5" data-testid="recipient-actions">
        {view.hasMore && (
          <Link href={`/c/${token}/more`} className="btn-more w-full justify-between" data-testid="learn-more">
            <span>Learn more</span><ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          {view.canSave && <a href={`/c/${token}/vcard`} rel="nofollow" className="btn-save" data-testid="save-phone"><ArrowDownToLine className="h-5 w-5" aria-hidden="true" /> Save</a>}
          {view.canConnect && <Link href={`/c/${token}/connect`} className="btn-connect" data-testid="connect"><UserPlus className="h-5 w-5" aria-hidden="true" /> Connect</Link>}
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-ink-muted">Not now? Just close this page. {first} won’t be told.</p>
      {!me && <p className="mt-3 text-center text-sm text-ink-muted" data-testid="oryn-invite">Want a card like this? <Link href="/welcome" className="font-semibold text-electric-600">Make your own ORYN card</Link> — free, and people you share with never need the app.</p>}
      <details className="mt-4 text-center text-sm text-ink-muted">
        <summary className="cursor-pointer list-none underline-offset-2 hover:underline">Report a problem</summary>
        <ActionForm action={reportAction} className="mt-3 text-left">
          <input type="hidden" name="token" value={token} />
          <label htmlFor="reason" className="label">What happened?</label>
          <textarea dir="auto" id="reason" name="reason" className="input min-h-[80px] py-3" maxLength={300} />
          <div className="mt-2"><Submit className="btn-more w-full">Send report</Submit></div>
        </ActionForm>
      </details>
    </RecipientFrame>
  )
}
