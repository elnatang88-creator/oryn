import { requireUser } from '@/lib/server/request'
import { personalInsights } from '@/lib/server/services/insights'
import { AppError } from '@/lib/server/errors'
import { PageHeader, PlanGate } from '@/components/ui'
import { interestAnalytics } from '@/lib/server/services/viewers'
import { INDUSTRY_LABEL } from '@/lib/industries'

export const metadata = { title: 'Insights' }

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')

export default async function InsightsPage() {
  const user = await requireUser()
  const data = await personalInsights(user.id).catch((e) => { if (e instanceof AppError && e.code === 'plan') return null; throw e })
  if (!data) return (<><PageHeader title="Insights" /><PlanGate message="Personal insights are part of Pro." /></>)
  const { s, byCapsule } = data
  const ia = await interestAnalytics(user.id).catch((e) => { if (e instanceof AppError && e.code === 'plan') return null; throw e })
  const tiles: [string, string, string][] = [
    ['Shares opened', pct(s.shares_opened, s.shares), `${s.shares_opened} of ${s.shares} shares`],
    ['Chose “Learn more”', pct(s.expanded, s.opened), `${s.expanded} of ${s.opened} opens`],
    ['Asked to connect', pct(s.requests, s.opened), `${s.requests} requests`],
    ['Follow-ups done', pct(s.followups_done, s.followups), `${s.followups_done} of ${s.followups}`],
  ]
  return (
    <>
      <PageHeader title="Insights" sub="Last 30 days." />
      <div className="card mb-6 bg-navy-900 px-5 py-5 text-white">
        <p className="text-sm text-soft-300">Meaningful connections</p>
        <p className="text-4xl font-bold">{s.meaningful}</p>
        <p className="text-sm text-soft-200">People you connected with and took a next step on (a note or a follow-up). Out of {s.connections} new connections.</p>
      </div>
      <dl className="mb-8 grid grid-cols-2 gap-3">
        {tiles.map(([k, v, sub]) => (
          <div key={k} className="card px-4 py-4"><dt className="text-sm text-ink-muted">{k}</dt><dd className="text-3xl font-bold text-navy-900">{v}</dd><dd className="text-xs text-ink-muted">{sub}</dd></div>
        ))}
      </dl>
      {ia ? <InterestSection ia={ia} /> : <div className="mb-8"><PlanGate message="Seeing which members viewed you, and their fields, is part of Pro." /></div>}
      <h2 className="h2 mb-3">By capsule</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-ink-muted"><tr><th className="px-4 py-3 font-semibold">Capsule</th><th className="px-2 py-3 font-semibold">Shares</th><th className="px-2 py-3 font-semibold">Opened</th><th className="px-2 py-3 font-semibold">Learn more</th><th className="px-4 py-3 font-semibold">Requests</th></tr></thead>
          <tbody className="divide-y divide-soft-100">{byCapsule.map((c) => <tr key={c.name}><td className="px-4 py-3 font-semibold">{c.name}</td><td className="px-2">{c.shares}</td><td className="px-2">{c.opened}</td><td className="px-2">{c.expanded}</td><td className="px-4">{c.requests}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  )
}

const FIELD_LABEL: Record<string, string> = { email: 'Email', phone: 'Phone', website: 'Website', social: 'Profile link', booking: 'Booking', company: 'Company', role: 'Role', location: 'Location', link: 'Link', text: 'Text' }

function Bars({ rows, testId }: { rows: { label: string; n: number }[]; testId: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n))
  return (
    <ul className="space-y-2" data-testid={testId}>
      {rows.map((r, i) => (
        <li key={r.label} className="text-sm">
          <div className="mb-1 flex justify-between"><span>{r.label}</span><span className="tabular-nums text-ink-muted">{r.n}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-soft-100"><div className="h-full origin-left animate-grow rounded-full bg-gradient-to-r from-[#8a6a2f] to-[#d8b56a]" style={{ width: `${(r.n / max) * 100}%`, animationDelay: `${i * 80}ms` }} /></div>
        </li>
      ))}
    </ul>
  )
}

function InterestSection({ ia }: { ia: Awaited<ReturnType<typeof interestAnalytics>> }) {
  const maxDay = Math.max(1, ...ia.perDay.map((d) => d.opens))
  return (
    <section className="mb-8 space-y-4" data-testid="interest-analytics">
      <h2 className="h2">Who’s interested</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="card px-4 py-4"><p className="text-sm text-ink-muted">Members who viewed</p><p className="text-3xl font-bold text-navy-900">{ia.members}</p></div>
        <div className="card px-4 py-4"><p className="text-sm text-ink-muted">Came back again</p><p className="text-3xl font-bold text-navy-900">{ia.returning}</p></div>
      </div>
      <div className="card p-4">
        <h3 className="mb-3 font-semibold">Opens, last 14 days</h3>
        <div className="flex h-24 items-end gap-1" aria-label="Opens per day">
          {ia.perDay.map((d, i) => (
            <div key={d.day} title={`${d.day}: ${d.opens}`} className="flex-1 origin-bottom animate-grow-y rounded-t bg-electric-400" style={{ height: `${Math.max(4, (d.opens / maxDay) * 100)}%`, animationDelay: `${i * 30}ms`, opacity: d.opens ? 1 : 0.25 }} />
          ))}
        </div>
      </div>
      <div className="card p-4">
        <h3 className="mb-3 font-semibold">Fields your viewers work in <span className="text-sm font-normal text-ink-muted">· 90 days</span></h3>
        {ia.byIndustry.length ? <Bars testId="industry-bars" rows={ia.byIndustry.map((r) => ({ label: r.industry ? INDUSTRY_LABEL[r.industry] ?? r.industry : 'Not stated', n: r.viewers }))} /> : <p className="text-sm text-ink-muted">No member views yet.</p>}
      </div>
      <div className="card p-4">
        <h3 className="mb-3 font-semibold">What they tapped <span className="text-sm font-normal text-ink-muted">· 90 days, anonymous</span></h3>
        {ia.byField.length ? <Bars testId="field-bars" rows={ia.byField.map((r) => ({ label: FIELD_LABEL[r.field_kind] ?? r.field_kind, n: r.taps }))} /> : <p className="text-sm text-ink-muted">No taps on your details yet.</p>}
      </div>
    </section>
  )
}
