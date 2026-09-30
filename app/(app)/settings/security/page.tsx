import { requireUser } from '@/lib/server/request'
import { listDevices, listSessions } from '@/lib/server/services/auth'
import { changePasswordAction, revokeOthersAction, revokeSessionAction, signOutEverywhereAction } from '@/app/actions/settings'
import { ActionForm, Submit } from '@/components/Forms'
import { PageHeader, relTime } from '@/components/ui'

export const metadata = { title: 'Security' }

export default async function SecurityPage() {
  const user = await requireUser()
  const [sessions, devices] = await Promise.all([listSessions(user.id, user.session_id), listDevices(user.id)])
  return (
    <>
      <PageHeader title="Security" sub="Where you’re signed in, and how to lock things down." />
      <section className="card mb-6 p-5">
        <h2 className="h2">Signed-in sessions</h2>
        <ul className="mt-3 divide-y divide-soft-100">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <span className="flex-1"><span className="block font-semibold">{s.device ?? 'Unknown device'} {s.current && <span className="chip-public ml-1">This device</span>}</span><span className="block text-sm text-ink-muted">Active {relTime(s.last_seen_at)} · signed in {relTime(s.created_at)}</span></span>
              <form action={revokeSessionAction}><input type="hidden" name="id" value={s.id} /><button className="btn-quiet text-sm text-signal-stop">Sign out</button></form>
            </li>
          ))}
        </ul>
        <ActionForm action={revokeOthersAction} className="mt-3"><Submit className="btn-more w-full">Sign out everywhere else</Submit></ActionForm>
      </section>
      <section className="card mb-6 p-5">
        <h2 className="h2">Known devices</h2>
        <ul className="mt-3 space-y-1 text-[15px]">{devices.map((d) => <li key={d.id}>{d.label} <span className="text-ink-muted">· last seen {relTime(d.last_seen_at)}</span></li>)}</ul>
      </section>
      <section className="card mb-6 p-5">
        <h2 className="h2">Change password</h2>
        <ActionForm action={changePasswordAction} className="mt-3 space-y-3" resetOnSuccess>
          <div><label className="label" htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" className="input" /></div>
          <div><label className="label" htmlFor="next">New password</label><input id="next" name="next" type="password" autoComplete="new-password" minLength={10} className="input" /></div>
          <div><label className="label" htmlFor="confirmpw">Repeat new password</label><input id="confirmpw" name="confirm" type="password" autoComplete="new-password" className="input" /></div>
          <Submit className="btn-save w-full">Change password</Submit>
        </ActionForm>
      </section>
      <section className="card p-5">
        <h2 className="h2">Two-step sign-in</h2>
        <p className="mt-2 text-[15px] text-ink-muted">Passkeys and authenticator codes are planned before general launch. Enterprise workspaces will use SSO.</p>
      </section>
      <form action={signOutEverywhereAction} className="mt-6"><button className="btn-stop w-full">Sign out of every session, including this one</button></form>
    </>
  )
}
