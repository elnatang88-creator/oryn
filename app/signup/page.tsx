import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/server/request'
import { signUpAction } from '@/app/actions/auth'
import { ActionForm, Submit } from '@/components/Forms'
import { Logo } from '@/components/Logo'

export const metadata = { title: 'Create your account' }

export default async function SignUp({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = '' } = await searchParams
  if (await currentUser()) redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/today')
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8"><Logo /></Link>
      <h1 className="h1">Create your account</h1>
      <p className="mt-1 text-ink-muted">Three things. Then your first capsule.</p>
      <ActionForm action={signUpAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <div><label className="label" htmlFor="name">Your name</label><input dir="auto" id="name" name="name" autoComplete="name" className="input" required maxLength={80} /></div>
        <div><label className="label" htmlFor="email">Email</label><input dir="auto" id="email" name="email" type="email" autoComplete="email" className="input" required /></div>
        <div><label className="label" htmlFor="password">Password</label><input dir="auto" id="password" name="password" type="password" autoComplete="new-password" minLength={10} className="input" required /><p className="hint mt-1">At least 10 characters.</p></div>
        <Submit pendingText="Creating…">Create account</Submit>
      </ActionForm>
      <p className="mt-4 text-center text-xs text-ink-muted">By continuing you agree to the Terms and <Link href="/privacy" className="underline">Privacy notice</Link> (drafts pending legal review).</p>
      <p className="mt-6 text-center text-[15px]">Have an account? <Link href={`/signin${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-electric-600">Sign in</Link></p>
    </main>
  )
}
