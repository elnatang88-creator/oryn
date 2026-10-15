import Link from 'next/link'
import { forgotPasswordAction } from '@/app/actions/auth'
import { ActionForm, Submit } from '@/components/Forms'
import { EntryShell } from '@/components/EntryShell'

export const metadata = { title: 'Forgot password' }

export default function ForgotPassword() {
  return (
    <EntryShell compact>
      <h1 className="text-2xl font-bold text-navy-900">Forgot your password?</h1>
      <p className="mt-1 text-ink-muted">We’ll email you a link to set a new one.</p>
      <ActionForm action={forgotPasswordAction} className="mt-6 space-y-4">
        <div><label className="label" htmlFor="email">Email</label><input dir="auto" id="email" name="email" type="email" autoComplete="email" className="input" required /></div>
        <Submit pendingText="Sending…">Send reset link</Submit>
      </ActionForm>
      <p className="mt-6 text-center text-[15px]"><Link href="/signin" className="font-semibold text-electric-600">Back to sign in</Link></p>
    </EntryShell>
  )
}
