import Link from 'next/link'
import { requireUser } from '@/lib/server/request'
import { privacyOverview } from '@/lib/server/services/privacy'
import { listShares } from '@/lib/server/services/sharing'
import { cancelDeletionAction, deletionAction, exportAction, retentionAction } from '@/app/actions/settings'
import { revokeAllAction, revokeShareAction } from '@/app/actions/sharing'
import { ActionForm, Submit } from '@/components/Forms'
import { PageHeader, PrivateBadge, PublicBadge, relTime } from '@/components/ui'

export const metadata = { title: 'Data & privacy' }

export default async function PrivacyPage() {
  const user = await requireUser()
  const [o, shares] = await Promise.all([privacyOverview(user.id), listShares(user.id, { activeOnly: true, limit: 20 })])
  return (
    <>
      <PageHeader title="Data & privacy" sub="Plain answers about what ORYN holds and who can see it." />

      <section className="card mb-6 p-5">
        <h2 className="h2">Who can see what</h2>
        <ul className="mt-4 space-y-3 text-[15px]">
          <li className="flex gap-3"><PublicBadge>Shared</PublicBadge><span>Only details you place in a capsule, only while a share is open, only to people who open that link.</span></li>
          <li className="flex gap-3"><PrivateBadge /><span>Private notes, follow-ups, hidden details, where you met, and your connections list.</span></li>
          <li className="flex gap-3"><PrivateBadge>Never collected</PrivateBadge><span>Who opened your capsule. We count opens; we don’t identify people unless they choose to connect.</span></li>
        </ul>
      </section>

      <section className="card mb-6 p-5">
        <div className="flex items-center justify-between"><h2 className="h2">Open shares</h2><span className="chip-muted">{shares.length} open</span></div>
        <ul className="mt-3 divide-y divide-soft-100">
          {shares.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 text-[15px]"><span className="font-semibold">{s.capsule_name}</span> <span className="text-ink-muted">· {s.context_label || s.channel} · {relTime(s.created_at)}</span></span>
              <form action={revokeShareAction}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="back" value="/settings/privacy" /><button className="btn-quiet text-sm text-signal-stop">Stop</button></form>
            </li>
          ))}
          {shares.length === 0 && <li className="py-3 text-ink-muted">Nothing is being shared.</li>}
        </ul>
        {shares.length > 0 && <ActionForm action={revokeAllAction} className="mt-3"><Submit className="btn-stop w-full">Stop all shares now</Submit></ActionForm>}
      </section>

      <section className="card mb-6 p-5">
        <h2 className="h2">What ORYN holds for you</h2>
        <p className="mt-2 text-[15px] text-ink-muted">{o.counts.capsules} capsules · {o.counts.connections} connections · {o.counts.notes} private notes · {o.counts.interactions} anonymous activity records</p>
        <ActionForm action={exportAction} className="mt-4"><Submit className="btn-more w-full">Download all my data</Submit></ActionForm>
        <ul className="mt-3 space-y-1 text-sm">
          {o.exports.map((e) => <li key={e.id}>{e.status === 'ready' ? <a className="font-semibold text-electric-600 underline" href={`/api/v1/me/exports/${e.id}`}>Export from {relTime(e.requested_at)} — download (JSON)</a> : <span className="text-ink-muted">Preparing export… refresh in a moment.</span>}</li>)}
        </ul>
      </section>

      <section className="card mb-6 p-5">
        <h2 className="h2">Keep activity history for</h2>
        <ActionForm action={retentionAction} className="mt-3 flex gap-2">
          <label htmlFor="days" className="sr-only">Retention</label>
          <select id="days" name="days" defaultValue={o.retentionDays ?? 'plan'} className="input mt-0 flex-1">
            <option value="plan">My plan’s default</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option>
          </select>
          <Submit className="btn-more">Save</Submit>
        </ActionForm>
        <p className="hint mt-2">Older anonymous activity is removed. Your connections and notes stay until you delete them.</p>
      </section>

      <section className="card border-signal-stop/20 p-5">
        <h2 className="h2">Delete my account</h2>
        {o.deletion ? (
          <div className="mt-2">
            <p className="text-[15px]">Scheduled for {new Date(o.deletion.scheduled_for).toLocaleDateString('en', { dateStyle: 'medium' })}. All your shares are already closed.</p>
            <form action={cancelDeletionAction} className="mt-3"><button className="btn-more w-full">Keep my account</button></form>
          </div>
        ) : (
          <ActionForm action={deletionAction} className="mt-2 space-y-3">
            <p className="text-[15px] text-ink-muted">Every share closes now. After 7 days, your capsules, connections, notes and history are erased. Security logs keep a record without your identity.</p>
            <div><label className="label" htmlFor="delpw">Enter your password to confirm</label><input id="delpw" name="password" type="password" className="input" autoComplete="current-password" /></div>
            <Submit className="btn-stop w-full">Delete my account</Submit>
          </ActionForm>
        )}
      </section>
      <p className="mt-6 text-center text-sm text-ink-muted"><Link href="/privacy" className="underline">Privacy notice</Link></p>
    </>
  )
}
