import Link from 'next/link'
import { ArrowRight, Search } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { listConnections, listRequests } from '@/lib/server/services/connections'
import { Empty, PageHeader, relTime, fmtDate } from '@/components/ui'

export const metadata = { title: 'Connections' }

export default async function ConnectionsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams
  const user = await requireUser()
  const [people, pending] = await Promise.all([listConnections(user.id, q), listRequests(user.id)])
  return (
    <>
      <PageHeader title="Connections" sub="People who chose to connect, and capsules you kept." />
      {pending.length > 0 && (
        <Link href="/connections/requests" className="card mb-5 flex min-h-[56px] items-center justify-between px-4 py-3 hover:border-electric-400" data-testid="requests-link">
          <span className="font-semibold">{pending.length} request{pending.length === 1 ? '' : 's'} waiting</span>
          <ArrowRight className="h-5 w-5 text-ink-faint" aria-hidden="true" />
        </Link>
      )}
      <form className="relative mb-5" role="search">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
        <input dir="auto" name="q" defaultValue={q} className="input mt-0 pl-12" placeholder="Search by name or where you met" aria-label="Search connections" />
      </form>
      {people.length === 0 ? (
        <Empty title={q ? 'No matches' : 'No connections yet'} body={q ? 'Try a different name or place.' : 'When someone asks to connect and you say yes, they appear here.'} />
      ) : (
        <ul className="card divide-y divide-soft-100">
          {people.map((c) => (
            <li key={c.id}>
              <Link href={`/connections/${c.id}`} className="flex min-h-[64px] items-center gap-3 px-4 py-3 hover:bg-soft-50">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-900 text-sm font-bold text-white" aria-hidden="true">{c.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
                <span className="min-w-0 flex-1">
                  <span dir="auto" className="block truncate font-semibold">{c.name}</span>
                  <span className="block truncate text-sm text-ink-muted">{c.met_where || (c.source === 'kept_capsule' ? 'Kept from a capsule' : 'Connected')} · {relTime(c.met_at)}</span>
                </span>
                {c.next_due && <span className="chip-public shrink-0">{fmtDate(c.next_due)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
