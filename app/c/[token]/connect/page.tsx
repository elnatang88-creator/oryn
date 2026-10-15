import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, CheckCircle2 } from 'lucide-react'
import { resolveShare } from '@/lib/server/services/sharing'
import { readClaim, currentUser } from '@/lib/server/request'
import { requestConnectAction } from '@/app/actions/recipient'
import { RecipientFrame, Unavailable } from '@/components/Recipient'
import { ActionForm, Submit } from '@/components/Forms'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ask to connect', robots: { index: false, follow: false } }

/** The recipient decides to identify themselves. Nothing is sent until they press the button. */
export default async function ConnectPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ sent?: string }> }) {
  const [{ token }, sp] = await Promise.all([params, searchParams])
  const res = await resolveShare(token, { claimToken: await readClaim() })
  if (res.status === 'needs_open') redirect(`/c/${token}`)
  if (res.status !== 'ok') return <Unavailable status={res.status} />
  if (!res.view.canConnect) redirect(`/c/${token}`)
  const first = res.view.displayName.split(' ')[0]
  const me = await currentUser()

  if (sp.sent) {
    return (
      <RecipientFrame>
        <div className="mt-16 rounded-capsule bg-white p-8 text-center shadow-lift" data-testid="request-sent">
          <CheckCircle2 className="mx-auto h-10 w-10 text-electric" aria-hidden="true" />
          <h1 className="mt-3 text-xl font-bold text-navy-900">Sent to {first}</h1>
          <p className="mt-1 text-ink-muted">If {first} would like to connect, they’ll reach out. No reply is also fine — there’s no pressure either way.</p>
          <Link href={`/c/${token}`} className="btn-more mt-6 w-full">Back to {first}’s capsule</Link>
        </div>
      </RecipientFrame>
    )
  }

  return (
    <RecipientFrame>
      <Link href={`/c/${token}`} className="btn-quiet mb-3 -ml-2"><ChevronLeft className="h-5 w-5" aria-hidden="true" /> Back</Link>
      <h1 className="h1">Ask {first} to connect</h1>
      <p className="mt-1 text-[15px] text-ink-muted">Only {first} sees this. Share one way to reach you — nothing more is needed.</p>
      <ActionForm action={requestConnectAction} className="card mt-5 space-y-4 p-5">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input dir="auto" id="name" name="name" className="input" autoComplete="name" defaultValue={me?.display_name ?? ''} maxLength={80} required />
        </div>
        <div>
          <label className="label" htmlFor="contact">One way to reach you</label>
          <input dir="auto" id="contact" name="contact" className="input" placeholder="Email, phone or a social handle" defaultValue={me?.email ?? ''} maxLength={160} required />
        </div>
        <div>
          <label className="label" htmlFor="message">A short note <span className="font-normal text-ink-muted">(optional)</span></label>
          <textarea dir="auto" id="message" name="message" className="input min-h-[90px] py-3" maxLength={300} placeholder="Where you met, or why you’d like to talk" />
        </div>
        <Submit pendingText="Sending…" className="btn-connect w-full">Send to {first}</Submit>
      </ActionForm>
    </RecipientFrame>
  )
}
