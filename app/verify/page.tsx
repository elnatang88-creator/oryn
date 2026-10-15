import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'
import { verifyEmailToken } from '@/lib/server/services/auth'
import { currentUser } from '@/lib/server/request'
import { EntryShell } from '@/components/EntryShell'

export const metadata = { title: 'Confirm email' }
export const dynamic = 'force-dynamic'

export default async function VerifyEmail({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams
  const r = token ? await verifyEmailToken(token) : { ok: false as const }
  const me = await currentUser()
  return (
    <EntryShell compact>
      {r.ok ? (
        <div className="text-center" data-testid="verify-ok">
          <CheckCircle2 className="mx-auto h-10 w-10 text-signal-ok" aria-hidden="true" />
          <h1 className="mt-3 text-2xl font-bold text-navy-900">Email confirmed</h1>
          <p className="mt-1 text-ink-muted">Your ORYN account is secured.</p>
          <Link href={me ? '/today' : '/signin'} className="btn-share mt-6 w-full">{me ? 'Continue' : 'Sign in'}</Link>
        </div>
      ) : (
        <div className="text-center" data-testid="verify-bad">
          <XCircle className="mx-auto h-10 w-10 text-signal-stop" aria-hidden="true" />
          <h1 className="mt-3 text-2xl font-bold text-navy-900">This link doesn’t work anymore</h1>
          <p className="mt-1 text-ink-muted">It may have expired or already been used.</p>
          <Link href={me ? '/settings/security' : '/signin'} className="btn-share mt-6 w-full">{me ? 'Send a new link' : 'Sign in'}</Link>
        </div>
      )}
    </EntryShell>
  )
}
