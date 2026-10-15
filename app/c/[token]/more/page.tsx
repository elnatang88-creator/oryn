import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ArrowDownToLine, BookmarkPlus, ChevronLeft, UserPlus } from 'lucide-react'
import { resolveShare } from '@/lib/server/services/sharing'
import { currentUser, readClaim } from '@/lib/server/request'
import { recordMemberView } from '@/lib/server/services/viewers'
import { ViewerNotice } from '@/components/ViewerNotice'
import { TapTracker } from '@/components/TapTracker'
import { CapsuleView } from '@/components/CapsuleView'
import { RecipientFrame, Unavailable, isBot } from '@/components/Recipient'
import { getDb } from '@/lib/server/db'
import { track } from '@/lib/server/analytics'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'More details', robots: { index: false, follow: false } }

/** Layer 2 — Expanded View. Only reached by choosing "Learn more". This is where ORYN is first offered. */
export default async function ExpandedView({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const claim = await readClaim()
  const peek = await resolveShare(token, { claimToken: claim, layer: 'expanded' })
  if (peek.status === 'needs_open') redirect(`/c/${token}`)
  if (peek.status !== 'ok') return <Unavailable status={peek.status} />
  if (!peek.session.allow_expanded) redirect(`/c/${token}`)
  const bot = isBot((await headers()).get('user-agent') ?? '')
  const res = bot ? peek : await resolveShare(token, { claimToken: claim, layer: 'expanded', record: true })
  if (res.status !== 'ok') return <Unavailable status={res.status} />
  const { view } = res
  const me = await currentUser()
  const member = me && me.id !== res.session.owner_user_id ? me : null
  if (member && !bot) await recordMemberView({ capsuleId: res.session.capsule_id, ownerId: res.session.owner_user_id, viewerId: member.id, shareSessionId: res.session.id, expanded: true })
  if (!bot && view.canSave) await track(await getDb(), 'app_offer_shown', { userId: res.session.owner_user_id, props: { layer: 'expanded' } })

  return (
    <RecipientFrame>
      <TapTracker token={token} />
      <Link href={`/c/${token}`} className="btn-quiet mb-3 -ml-2"><ChevronLeft className="h-5 w-5" aria-hidden="true" /> Back</Link>
      {member && <ViewerNotice viewerName={member.display_name} ownerFirst={view.displayName.split(' ')[0]} visible={member.view_visibility === 'visible'} />}
      <CapsuleView view={view} />
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {view.canSave && <a href={`/c/${token}/vcard`} rel="nofollow" className="btn-save"><ArrowDownToLine className="h-5 w-5" aria-hidden="true" /> Save</a>}
        {view.canConnect && <Link href={`/c/${token}/connect`} className="btn-connect"><UserPlus className="h-5 w-5" aria-hidden="true" /> Connect</Link>}
      </div>
      {view.canSave && (
        <section className="mt-6 rounded-3xl border border-soft-200 bg-white p-5" data-testid="app-offer">
          <p className="font-bold text-navy-900">Want to remember this?</p>
          <p className="mt-1 text-[15px] text-ink-muted">Keep it in ORYN with where you met, a private note and a reminder. Free, right here in your browser — no app needed.</p>
          <Link href={`/c/${token}/keep`} className="btn-more mt-4 w-full" data-testid="keep"><BookmarkPlus className="h-5 w-5" aria-hidden="true" /> Keep in ORYN</Link>
        </section>
      )}
    </RecipientFrame>
  )
}
