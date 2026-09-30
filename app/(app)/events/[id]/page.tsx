import Link from 'next/link'
import { notFound } from 'next/navigation'
import { QrCode, Users } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { getEvent } from '@/lib/server/services/events'
import { AppError } from '@/lib/server/errors'
import { eventRulesAction, eventStatusAction } from '@/app/actions/workspace'
import { ActionForm, Submit } from '@/components/Forms'
import { PageHeader, fmtDate } from '@/components/ui'

export const metadata = { title: 'Event' }

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const data = await getEvent(user.id, id).catch((e) => { if (e instanceof AppError) return null; throw e })
  if (!data) notFound()
  const { event: e, stats } = data
  const next = e.status === 'draft' ? { s: 'live', label: 'Go live' } : e.status === 'live' ? { s: 'ended', label: 'End event' } : null
  return (
    <>
      <PageHeader title={e.name} sub={[e.venue, e.starts_on && fmtDate(e.starts_on)].filter(Boolean).join(' · ')} action={next && (
        <form action={eventStatusAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value={next.s} /><button className={next.s === 'ended' ? 'btn-stop' : 'btn-share'}>{next.label}</button></form>
      )} />
      {e.status === 'ended' && <p className="card mb-6 px-4 py-3 text-ink-muted">This event has ended. All its shares are closed.</p>}
      <dl className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Shares', stats.shares], ['Opened', stats.opened], ['Requests', stats.requests], ['Connections', stats.connections]].map(([k, v]) => (
          <div key={k} className="card px-4 py-3"><dt className="text-sm text-ink-muted">{k}</dt><dd className="text-2xl font-bold text-navy-900">{v}</dd></div>
        ))}
      </dl>
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <Link href={`/events/${e.id}/participants`} className="card flex min-h-[64px] items-center gap-3 px-5 hover:border-electric-400"><Users className="h-5 w-5 text-electric" aria-hidden="true" /> <span className="font-semibold">Participants</span></Link>
        <Link href={`/stations?org=${e.org_id}`} className="card flex min-h-[64px] items-center gap-3 px-5 hover:border-electric-400"><QrCode className="h-5 w-5 text-electric" aria-hidden="true" /> <span className="font-semibold">Stations & QR codes</span></Link>
      </div>
      <h2 className="h2 mb-3">Sharing rules</h2>
      <ActionForm action={eventRulesAction} className="card space-y-4 p-5">
        <input type="hidden" name="id" value={e.id} />
        <label className="flex min-h-[48px] items-center gap-3"><input type="checkbox" name="allowPhone" defaultChecked={e.rules.allowPhone} className="h-5 w-5 accent-electric" /> Allow phone numbers in event shares</label>
        <div><label className="label" htmlFor="note">Note for participants</label><input dir="auto" id="note" name="note" defaultValue={e.rules.note} className="input" maxLength={200} /></div>
        <p className="hint">Rules apply instantly to every share at this event, including ones already open. ORYN does not collect attendee lists from shares — people connect one by one, by choice.</p>
        <Submit>Save rules</Submit>
      </ActionForm>
    </>
  )
}
