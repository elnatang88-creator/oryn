import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Download, Search } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { getDb } from '@/lib/server/db'
import { listRegistrations, registrationStats, ticketToken } from '@/lib/server/services/registrations'
import { AppError } from '@/lib/server/errors'
import { PageHeader, relTime } from '@/components/ui'

export const metadata = { title: 'Registrations' }

export default async function RegistrationsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const [{ id }, { q = '' }] = await Promise.all([params, searchParams])
  const user = await requireUser()
  const rows = await listRegistrations(user.id, id, q).catch((e) => { if (e instanceof AppError) return null; throw e })
  if (!rows) notFound()
  const [stats, [e]] = await Promise.all([registrationStats(user.id, id), (await getDb()).query<{ name: string; capacity: number | null }>(`SELECT name, capacity FROM events WHERE id = $1`, [id])])
  return (
    <>
      <Link href={`/events/${id}`} className="btn-quiet -ml-2 mb-2"><ChevronLeft className="h-5 w-5" aria-hidden="true" /> {e.name}</Link>
      <PageHeader title="Registrations" sub={`${stats.confirmed} confirmed${e.capacity ? ` of ${e.capacity}` : ''} · ${stats.waitlisted} waitlisted · ${stats.checked_in} checked in`} action={<a href={`/api/v1/events/${id}/registrations?format=csv`} className="btn-more"><Download className="h-5 w-5" aria-hidden="true" /> CSV</a>} />
      <form className="relative mb-4" role="search">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
        <input dir="auto" name="q" defaultValue={q} className="input mt-0 pl-12" placeholder="Name, email or company" aria-label="Search registrations" />
      </form>
      {rows.length === 0 ? <p className="card px-4 py-4 text-ink-muted">{q ? 'No one matches.' : 'No registrations yet. Share the public event page.'}</p> : (
        <ul className="card divide-y divide-soft-100" data-testid="registrations">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1"><span dir="auto" className="block truncate font-semibold">{r.name}</span><span className="block truncate text-xs text-ink-muted">{[r.company, r.email].filter(Boolean).join(' · ')} · {relTime(r.created_at)}</span></span>
              <span className={`chip ${r.checked_in_at ? 'bg-emerald-50 text-signal-ok' : r.status === 'confirmed' ? 'chip-public' : 'chip-muted'} capitalize`}>{r.checked_in_at ? 'Checked in' : r.status}</span>
              <a href={`/ticket/${ticketToken(r.id)}`} className="btn-quiet text-sm" target="_blank" rel="noopener">Ticket</a>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
