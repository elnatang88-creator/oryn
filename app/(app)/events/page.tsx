import Link from 'next/link'
import { Plus } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { listEvents } from '@/lib/server/services/events'
import { listMyOrgs } from '@/lib/server/services/orgs'
import { Empty, PageHeader, fmtDate } from '@/components/ui'

export const metadata = { title: 'Events' }

export default async function EventsPage() {
  const user = await requireUser()
  const [events, orgs] = await Promise.all([listEvents(user.id), listMyOrgs(user.id)])
  const canCreate = orgs.some((o) => ['owner', 'admin', 'manager'].includes(o.role))
  return (
    <>
      <PageHeader title="Events" sub="Relevant connections, no stack of cards." action={canCreate ? <Link href="/events/new" className="btn-more"><Plus className="h-5 w-5" aria-hidden="true" /> New event</Link> : undefined} />
      {events.length === 0 ? (
        <Empty title="No events yet" body={canCreate ? 'Set up an event so participants and booths share with the same rules.' : 'Event mode is for teams. Create a workspace in Teams to organize one.'} action={canCreate ? <Link href="/events/new" className="btn-share">Create an event</Link> : <Link href="/teams" className="btn-more">Go to Teams</Link>} />
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={e.my_role ? `/events/${e.id}` : `/share`} className="card flex min-h-[72px] items-center justify-between gap-3 px-5 py-4 hover:border-electric-400">
                <span>
                  <span className="block font-bold text-navy-900">{e.name}</span>
                  <span className="block text-sm text-ink-muted">{e.org_name}{e.venue ? ` · ${e.venue}` : ''}{e.starts_on ? ` · ${fmtDate(e.starts_on)}` : ''} · {e.participants} people</span>
                </span>
                <span className={`chip ${e.status === 'live' ? 'bg-emerald-50 text-signal-ok' : 'bg-soft-100 text-ink-muted'}`}>{e.status === 'live' ? 'Live' : e.status === 'draft' ? 'Draft' : 'Ended'}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
