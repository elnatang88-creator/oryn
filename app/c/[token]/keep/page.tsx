import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookmarkPlus, ChevronLeft } from 'lucide-react'
import { resolveShare } from '@/lib/server/services/sharing'
import { currentUser, readClaim } from '@/lib/server/request'
import { keepAction } from '@/app/actions/recipient'
import { RecipientFrame, Unavailable } from '@/components/Recipient'
import { ActionForm, Submit } from '@/components/Forms'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Keep in ORYN', robots: { index: false, follow: false } }

/** Layer 3 entry: the relationship view lives in the recipient's own ORYN space. */
export default async function KeepPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const res = await resolveShare(token, { claimToken: await readClaim() })
  if (res.status === 'needs_open') redirect(`/c/${token}`)
  if (res.status !== 'ok') return <Unavailable status={res.status} />
  const me = await currentUser()
  const first = res.view.displayName.split(' ')[0]
  return (
    <RecipientFrame>
      <Link href={`/c/${token}/more`} className="btn-quiet mb-3 -ml-2"><ChevronLeft className="h-5 w-5" aria-hidden="true" /> Back</Link>
      <h1 className="h1">Keep {first} in ORYN</h1>
      <ul className="card mt-5 space-y-3 p-5 text-[15px]">
        <li>• What {first} shared, saved as it is now</li>
        <li>• Where and when you met</li>
        <li>• Private notes and a reminder to follow up</li>
      </ul>
      <p className="mt-3 text-sm text-ink-muted">{first} is not told who kept it — only that it was saved.</p>
      <ActionForm action={keepAction} className="mt-5">
        <input type="hidden" name="token" value={token} />
        <Submit className="btn-share w-full">
          <BookmarkPlus className="h-5 w-5" aria-hidden="true" /> {me ? 'Keep it' : 'Create a free account to keep it'}
        </Submit>
      </ActionForm>
      {!me && <p className="mt-3 text-center text-sm">Already have ORYN? <Link className="font-semibold text-electric-600" href={`/signin?next=${encodeURIComponent(`/c/${token}/keep`)}`}>Sign in</Link></p>}
    </RecipientFrame>
  )
}
