import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/server/request'
import { signInAction } from '@/app/actions/auth'
import { ActionForm, Submit } from '@/components/Forms'
import { Logo } from '@/components/Logo'

export const metadata = { title: 'Sign in' }

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = '' } = await searchParams
  if (await currentUser()) redirect('/today')
  const demo = process.env.NODE_ENV !== 'production' || process.env.ORYN_SEED_DEMO === 'true'
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8"><Logo /></Link>
      <h1 className="h1">Welcome back</h1>
      <ActionForm action={signInAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <div><label className="label" htmlFor="email">Email</label><input dir="auto" id="email" name="email" type="email" autoComplete="email" className="input" required /></div>
        <div><label className="label" htmlFor="password">Password</label><input dir="auto" id="password" name="password" type="password" autoComplete="current-password" className="input" required /></div>
        <Submit pendingText="Signing in…">Sign in</Submit>
      </ActionForm>
      <p className="mt-6 text-center text-[15px]">New to ORYN? <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-electric-600">Create an account</Link></p>
      {demo && <p className="mt-8 rounded-2xl bg-soft-100 px-4 py-3 text-sm text-navy-900" data-testid="demo-credentials">Local demo (fictional data): <code>demo@oryn.local</code>. The password is <code>ORYN_DEMO_PASSWORD</code>, or the one printed in the server console on first start.</p>}
    </main>
  )
}
