import { requireUser } from '@/lib/server/request'
import { personalInsights } from '@/lib/server/services/insights'
import { AppError } from '@/lib/server/errors'
import { PageHeader, PlanGate } from '@/components/ui'

export const metadata = { title: 'Insights' }

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')

export default async function InsightsPage() {
  const user = await requireUser()
  const data = await personalInsights(user.id).catch((e) => { if (e instanceof AppError && e.code === 'plan') return null; throw e })
  if (!data) return (<><PageHeader title="Insights" /><PlanGate message="Personal insights are part of Pro." /></>)
  const { s, byCapsule } = data
  const tiles: [string, string, string][] = [
    ['Shares opened', pct(s.shares_opened, s.shares), `${s.shares_opened} of ${s.shares} shares`],
    ['Chose “Learn more”', pct(s.expanded, s.opened), `${s.expanded} of ${s.opened} opens`],
    ['Asked to connect', pct(s.requests, s.opened), `${s.requests} requests`],
    ['Follow-ups done', pct(s.followups_done, s.followups), `${s.followups_done} of ${s.followups}`],
  ]
  return (
    <>
      <PageHeader title="Insights" sub="Last 30 days. Counts only — never who." />
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
