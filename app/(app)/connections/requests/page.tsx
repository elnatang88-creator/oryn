import { requireUser } from '@/lib/server/request'
import { listRequests } from '@/lib/server/services/connections'
import { RespondButtons } from '@/components/RespondButtons'
import { Empty, PageHeader, relTime } from '@/components/ui'

export const metadata = { title: 'Requests' }

export default async function RequestsPage() {
  const user = await requireUser()
  const requests = await listRequests(user.id)
  return (
    <>
      <PageHeader title="Requests" sub="People who asked to connect. You decide — they’re never told if you pass." />
      {requests.length === 0 ? (
        <Empty title="All clear" body="No one is waiting on you." />
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.id} className="card p-5" data-testid="request-card">
              <p dir="auto" className="text-lg font-bold text-navy-900">{r.from_name}</p>
              <p className="text-sm text-ink-muted">Via “{r.capsule_name}”{r.event_name ? ` at ${r.event_name}` : r.context_label ? ` · ${r.context_label}` : ''} · {relTime(r.created_at)}</p>
              {r.message && <p dir="auto" className="mt-3 rounded-xl bg-soft-50 px-4 py-3">“{r.message}”</p>}
              <p className="mt-3 text-sm"><span className="text-ink-muted">They shared:</span> <span className="font-medium">{r.from_contact}</span></p>
<RespondButtons id={r.id} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
