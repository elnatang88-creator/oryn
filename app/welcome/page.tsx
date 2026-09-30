import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/server/request'
import { EntryShell } from '@/components/EntryShell'

export const metadata = { title: 'Welcome' }

/** Start screen of the installed app (manifest start_url). Signed-in people go straight to Today. */
export default async function Welcome() {
  if (await currentUser()) redirect('/today')
  return (
    <EntryShell>
      <h1 className="text-center text-[28px] font-bold leading-tight tracking-tight text-navy-900">Your card. Your rules.</h1>
      <p className="mx-auto mt-2 max-w-xs text-center text-[15px] text-ink-muted">Design a card that’s only yours. Share it in a second. See who’s interested.</p>
      <div className="mt-6 space-y-3">
        <Link href="/signup" className="btn-share w-full" data-testid="welcome-create">Create my card</Link>
        <Link href="/signin" className="btn-more w-full" data-testid="welcome-signin">I have an account</Link>
      </div>
      <p className="mt-4 text-center text-xs text-ink-muted">People you share with never need the app. <Link href="/privacy" className="underline">Privacy</Link></p>
    </EntryShell>
  )
}
