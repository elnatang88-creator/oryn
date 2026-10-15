import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { getDb } from '@/lib/server/db'
import { requireCheckInStaff, checkInHistory } from '@/lib/server/services/registrations'
import { AppError } from '@/lib/server/errors'
import { CheckInScanner } from '@/components/CheckInScanner'
import { PageHeader, relTime } from '@/components/ui'

export const metadata = { title: 'Check-in' }

export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const db = await getDb()
  const ok = await requireCheckInStaff(db, user.id, id).then(() => true).catch((e) => { if (e instanceof AppError) return false; throw e })
  if (!ok) notFound()
  const [e] = await db.query<{ name: string }>(`SELECT name FROM events WHERE id = $1`, [id])
  const history = await checkInHistory(user.id, id, 15)
  return (
    <>
      <Link href={`/events/${id}`} className="btn-quiet -ml-2 mb-2"><ChevronLeft className="h-5 w-5" aria-hidden="true" /> {e.name}</Link>
      <PageHeader title="Check-in" sub="Scan the ticket code or search by name. Each ticket is admitted once." />
      <CheckInScanner eventId={id} />
      <section className="mt-8">
        <h2 className="h2 mb-3">Recent</h2>
        {history.length === 0 ? <p className="card px-4 py-4 text-sm text-ink-muted">No one checked in yet.</p> : (
          <ul className="card divide-y divide-soft-100" data-testid="checkin-history">
            {history.map((h) => <li key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-[15px]"><span dir="auto" className="min-w-0 flex-1 truncate font-medium">{h.name}{h.company ? <span className="text-ink-muted"> · {h.company}</span> : null}</span><span className="text-xs text-ink-muted">{h.method} · {relTime(h.created_at)}{h.staff ? ` · ${h.staff}` : ''}</span></li>)}
          </ul>
        )}
      </section>
    </>
  )
}
