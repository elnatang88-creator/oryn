import Link from 'next/link'
import { resetPasswordAction } from '@/app/actions/auth'
import { ActionForm, Submit } from '@/components/Forms'
import { EntryShell } from '@/components/EntryShell'

export const metadata = { title: 'Set a new password' }

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams
  return (
    <EntryShell compact>
      <h1 className="text-2xl font-bold text-navy-900">Set a new password</h1>
      {!token ? (
        <p className="mt-2 text-ink-muted">This link is missing its code. <Link href="/forgot" className="font-semibold text-electric-600">Ask for a new one</Link>.</p>
      ) : (
        <ActionForm action={resetPasswordAction} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={token} />
          <div><label className="label" htmlFor="password">New password</label><input dir="auto" id="password" name="password" type="password" autoComplete="new-password" minLength={10} className="input" required /><p className="hint mt-1">At least 10 characters. Every other session will be signed out.</p></div>
          <div><label className="label" htmlFor="confirm">Repeat it</label><input dir="auto" id="confirm" name="confirm" type="password" autoComplete="new-password" className="input" required /></div>
          <Submit pendingText="Saving…">Save new password</Submit>
        </ActionForm>
      )}
    </EntryShell>
  )
}
