import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { ADMIN_MODULES, adminModule, operationalAlerts, type AdminModule } from '@/lib/server/services/admin'
import { AppError } from '@/lib/server/errors'
import { PageHeader } from '@/components/ui'
import { emailTransport } from '@/lib/server/email'
import { walletStatus } from '@/lib/server/wallet'
import { aiProvider } from '@/lib/server/ai'

export const metadata = { title: 'Command Center' }

/** Command Center modules: one table per module, searchable, read-only here (writes live on the main admin page). */
export default async function AdminModulePage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<{ q?: string }> }) {
  const [{ module }, { q = '' }] = await Promise.all([params, searchParams])
  if (!ADMIN_MODULES.includes(module as AdminModule)) notFound()
  const user = await requireUser()
  const rows = await adminModule(user.id, module as AdminModule, q).catch((e) => { if (e instanceof AppError) return null; throw e })
  if (!rows) notFound()
  const alerts = module === 'health' ? await operationalAlerts(user.id) : []
  const cols = rows.length ? Object.keys(rows[0] as object) : []
  const fmt = (v: unknown) => (v instanceof Date ? v.toISOString().replace('T', ' ').slice(0, 16) : v === null || v === undefined ? '—' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v))
  return (
    <>
      <Link href="/admin" className="btn-quiet -ml-2 mb-2"><ChevronLeft className="h-5 w-5" aria-hidden="true" /> Command Center</Link>
      <PageHeader title={module[0].toUpperCase() + module.slice(1)} sub="Platform administrators only. Every view is in the audit log." />
      <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Modules">{ADMIN_MODULES.map((m) => <Link key={m} href={`/admin/${m}`} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold capitalize ${m === module ? 'bg-navy-900 text-white' : 'border border-soft-300 bg-white'}`}>{m}</Link>)}</nav>
      {module === 'health' && (
        <section className="mb-4" aria-labelledby="ops-alerts" data-testid="ops-alerts" data-count={alerts.length}>
          <h2 id="ops-alerts" className="h2 mb-2">Operational alerts</h2>
          {alerts.length === 0 ? <p className="card px-4 py-3 text-sm text-signal-ok">All clear — nothing needs an operator right now.</p> : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li key={a.title} className={`card px-4 py-3 ${a.level === 'critical' ? 'border-red-200 bg-red-50' : a.level === 'warning' ? 'border-amber-200 bg-amber-50' : ''}`} data-level={a.level}>
                  <p className="font-semibold">{a.level === 'critical' ? '🔴' : a.level === 'warning' ? '🟠' : 'ℹ️'} {a.title}</p>
                  <p className="text-sm text-ink-muted">{a.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {module === 'health' && (
        <dl className="card mb-4 grid grid-cols-2 gap-2 p-4 text-sm sm:grid-cols-3" data-testid="platform-config">
          <div><dt className="text-ink-muted">Email transport</dt><dd className="font-semibold">{emailTransport()}</dd></div>
          <div><dt className="text-ink-muted">AI provider</dt><dd className="font-semibold">{aiProvider()}</dd></div>
          <div><dt className="text-ink-muted">Apple Wallet</dt><dd className="font-semibold">{walletStatus().apple.configured ? 'configured' : 'integration pending'}</dd></div>
          <div><dt className="text-ink-muted">Google Wallet</dt><dd className="font-semibold">{walletStatus().google.configured ? 'configured' : 'integration pending'}</dd></div>
          <div><dt className="text-ink-muted">Jobs</dt><dd className="font-semibold">{process.env.CRON_SECRET ? 'scheduler secret set' : 'no CRON_SECRET'}</dd></div>
        </dl>
      )}
      {['users', 'businesses', 'events', 'stations', 'audit'].includes(module) && <form className="mb-4"><input dir="auto" name="q" defaultValue={q} className="input mt-0" placeholder="Search" aria-label="Search" /></form>}
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="admin-table">
          <thead className="text-ink-muted"><tr>{cols.map((c) => <th key={c} className="px-3 py-2 font-semibold">{c.replace(/_/g, ' ')}</th>)}</tr></thead>
          <tbody className="divide-y divide-soft-100">{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className="px-3 py-2 whitespace-nowrap">{fmt((r as Record<string, unknown>)[c])}</td>)}</tr>)}{rows.length === 0 && <tr><td className="px-3 py-3 text-ink-muted">Nothing here.</td></tr>}</tbody>
        </table>
      </div>
    </>
  )
}
