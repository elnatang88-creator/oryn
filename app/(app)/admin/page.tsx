import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/server/request'
import { adminOverview } from '@/lib/server/services/admin'
import { productMetrics } from '@/lib/server/services/insights'
import { AppError } from '@/lib/server/errors'
import { adminFlagAction, adminPlanAction, adminUserPlanAction } from '@/app/actions/settings'
import { ActionForm, Submit } from '@/components/Forms'
import { PageHeader, relTime } from '@/components/ui'

export const metadata = { title: 'Admin' }

const fmt = (v: number | null | undefined, pct = false) => (v === null || v === undefined ? '—' : pct ? `${Math.round(v * 100)}%` : String(Math.round(v)))

export default async function AdminPage() {
  const user = await requireUser()
  const data = await adminOverview(user.id).catch((e) => { if (e instanceof AppError) return null; throw e })
  if (!data) notFound()
  const m = await productMetrics()
  return (
    <>
      <PageHeader title="Admin console" sub="Every visit here is recorded in the audit log." />
      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Object.entries(data.stats).map(([k, v]) => <div key={k} className="card px-4 py-3"><dt className="text-xs uppercase tracking-wide text-ink-muted">{k.replace(/_/g, ' ')}</dt><dd className="text-2xl font-bold text-navy-900">{v}</dd></div>)}
      </dl>
      <section className="card mb-6 p-5">
        <h2 className="h2">Product value (30 days)</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[['Median sec to first capsule', fmt(m.median_sec_to_first_capsule)], ['Median sec to first share', fmt(m.median_sec_to_first_share)], ['Recipient view rate', fmt(m.recipient_view_rate, true)], ['Expanded view rate', fmt(m.expanded_view_rate, true)], ['Connect request rate', fmt(m.connect_request_rate, true)], ['Follow-up completion', fmt(m.followup_completion_rate, true)], ['Shares revoked', fmt(m.revoked_share_rate, true)], ['Plan gate hits', fmt(m.plan_gate_hits)]].map(([k, v]) => <div key={k}><dt className="text-ink-muted">{k}</dt><dd className="text-lg font-bold">{v}</dd></div>)}
        </dl>
      </section>
      <section className="card mb-6 p-5">
        <h2 className="h2">Plan catalog</h2>
        <p className="hint">Prices and limits are data. Leave price empty until research is done.</p>
        <div className="mt-3 space-y-3">
          {data.plans.map((p) => (
            <ActionForm key={p.key} action={adminPlanAction} className="grid items-end gap-2 rounded-xl bg-soft-50 p-3 sm:grid-cols-[110px_1fr_110px_110px_auto]">
              <input type="hidden" name="key" value={p.key} />
              <p className="font-bold">{p.name}</p>
              <div><label className="text-xs text-ink-muted" htmlFor={`pl-${p.key}`}>Price label</label><input id={`pl-${p.key}`} name="priceLabel" defaultValue={p.price_label ?? ''} className="input mt-0 min-h-[40px]" /></div>
              <div><label className="text-xs text-ink-muted" htmlFor={`cl-${p.key}`}>Capsules</label><input id={`cl-${p.key}`} name="capsules" type="number" defaultValue={p.limits.capsules} className="input mt-0 min-h-[40px]" /></div>
              <div><label className="text-xs text-ink-muted" htmlFor={`hd-${p.key}`}>History days</label><input id={`hd-${p.key}`} name="historyDays" type="number" defaultValue={p.limits.historyDays} className="input mt-0 min-h-[40px]" /></div>
              <Submit className="btn-more min-h-[40px] text-sm">Save</Submit>
            </ActionForm>
          ))}
        </div>
      </section>
      <section className="card mb-6 p-5">
        <h2 className="h2">Feature flags</h2>
        <ul className="mt-3 divide-y divide-soft-100">
          {data.flags.map((f) => (
            <li key={f.key} className="flex items-center gap-3 py-2.5">
              <span className="flex-1"><code className="text-sm font-semibold">{f.key}</code><span className="block text-sm text-ink-muted">{f.description}</span></span>
              <form action={adminFlagAction}><input type="hidden" name="key" value={f.key} /><input type="hidden" name="enabled" value={f.enabled ? 'false' : 'true'} /><button className={f.enabled ? 'btn-connect min-h-[40px] text-sm' : 'btn-more min-h-[40px] text-sm'}>{f.enabled ? 'On' : 'Off'}</button></form>
            </li>
          ))}
        </ul>
      </section>
      <section className="card mb-6 p-5">
        <h2 className="h2">Users</h2>
        <ul className="mt-3 divide-y divide-soft-100 text-sm">
          {data.users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="flex-1">{u.display_name} <span className="text-ink-muted">· {u.email} · joined {relTime(u.created_at)}</span></span>
              <form action={adminUserPlanAction} className="flex gap-1"><input type="hidden" name="userId" value={u.id} />
                <select name="plan" defaultValue={u.plan_key} aria-label={`Plan for ${u.email}`} className="input mt-0 min-h-[36px] w-auto py-0 text-sm">{data.plans.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
                <button className="btn-quiet min-h-[36px] text-sm">Set</button></form>
            </li>
          ))}
        </ul>
      </section>
      <section className="card mb-6 p-5">
        <h2 className="h2">Reports</h2>
        <ul className="mt-3 space-y-2 text-sm">{data.reports.map((r) => <li key={r.id}>{relTime(r.created_at)} — {r.meta.reason || '(no reason given)'}</li>)}{data.reports.length === 0 && <li className="text-ink-muted">No reports.</li>}</ul>
      </section>
      <section className="card p-5">
        <h2 className="h2">Audit log</h2>
        <ul className="mt-3 max-h-96 divide-y divide-soft-100 overflow-y-auto text-sm">{data.auditLog.map((a) => <li key={a.id} className="flex justify-between gap-2 py-2"><span><code>{a.action}</code> <span className="text-ink-muted">· {a.actor ?? 'system'}</span></span><span className="shrink-0 text-ink-muted">{relTime(a.created_at)}</span></li>)}</ul>
      </section>
    </>
  )
}
