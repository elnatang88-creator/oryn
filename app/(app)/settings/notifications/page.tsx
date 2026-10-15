import { requireUser, appOrigin } from '@/lib/server/request'
import { getDb } from '@/lib/server/db'
import { notificationPrefsAction } from '@/app/actions/settings'
import { ActionForm, Submit } from '@/components/Forms'
import { PageHeader } from '@/components/ui'
import { aiProvider } from '@/lib/server/ai'
import { emailTransport } from '@/lib/server/email'

export const metadata = { title: 'Notifications & address' }

export default async function NotificationsPage() {
  const user = await requireUser()
  const [u] = await (await getDb()).query<{ notify_email: boolean; ai_consent_at: Date | null; username: string | null }>(`SELECT notify_email, ai_consent_at, username FROM users WHERE id = $1`, [user.id])
  const origin = await appOrigin()
  return (
    <>
      <PageHeader title="Notifications & public address" />
      <ActionForm action={notificationPrefsAction} className="card space-y-5 p-5">
        <div>
          <label className="label" htmlFor="username">Your public address</label>
          <div className="flex items-center gap-1"><span className="text-sm text-ink-muted">{origin}/u/</span><input dir="ltr" id="username" name="username" defaultValue={u.username ?? ''} className="input mt-0 flex-1" maxLength={30} placeholder="your-name" data-testid="username" /></div>
          <p className="hint mt-1">Always opens your active card. Leave empty to have no public address. You can stop its link from Data &amp; privacy at any time.</p>
        </div>
        <label className="flex min-h-[48px] items-start gap-3"><input type="checkbox" name="notify_email" defaultChecked={u.notify_email} className="mt-1 h-5 w-5 accent-electric" /><span><span className="block font-semibold">Email me about activity</span><span className="block text-sm text-ink-muted">Requests, acceptances, reminders and tickets. Security emails are always sent.{emailTransport() === 'none' ? ' (This server has no email transport configured yet.)' : ''}</span></span></label>
        <label className="flex min-h-[48px] items-start gap-3"><input type="checkbox" name="ai_consent" defaultChecked={!!u.ai_consent_at} className="mt-1 h-5 w-5 accent-electric" data-testid="ai-consent" /><span><span className="block font-semibold">AI assistance</span><span className="block text-sm text-ink-muted">Lets ORYN send the details you choose (your card, a contact’s name and your notes about them, a lead) to the configured AI provider to draft text for you. Off = everything is written from templates on this server.{aiProvider() === 'none' ? ' No AI provider is configured on this server, so this is off regardless.' : ''}</span></span></label>
        <Submit className="btn-save w-full">Save</Submit>
      </ActionForm>
    </>
  )
}
