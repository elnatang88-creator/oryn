import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClipboardList, Globe, QrCode, ScanLine, Users } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { getEvent } from '@/lib/server/services/events'
import { myEventRelationships } from '@/lib/server/services/today'
import { AppError } from '@/lib/server/errors'
import { eventDetailsAction, eventRulesAction, eventStatusAction } from '@/app/actions/workspace'
import { appOrigin } from '@/lib/server/request'
import { getDb } from '@/lib/server/db'
import { ActionForm, Submit } from '@/components/Forms'
import { PageHeader, fmtDate } from '@/components/ui'

export const metadata = { title: 'Event' }

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const data = await getEvent(user.id, id).catch((e) => { if (e instanceof AppError) return null; throw e })
  if (!data) notFound()
  const { event: e, stats } = data
  const mine = await myEventRelationships(user.id, e.id)
  const db = await getDb()
  const [pub] = await db.query<{ slug: string | null; description: string; timezone: string; starts_at: Date | null; ends_at: Date | null; capacity: number | null; published: boolean; registration_open: boolean; waitlist: boolean; registration_fields: { id: string; label: string; kind: string; required: boolean; options?: string[] }[]; ticket_types: { name: string; price_label: string | null; quantity: number | null }[] }>(
    `SELECT slug, description, timezone, starts_at, ends_at, capacity, published, registration_open, waitlist, registration_fields, ticket_types FROM events WHERE id = $1`, [e.id])
  const [reg] = await db.query<{ confirmed: number; waitlisted: number; checked_in: number }>(`SELECT count(*) FILTER (WHERE status = 'confirmed')::int AS confirmed, count(*) FILTER (WHERE status = 'waitlisted')::int AS waitlisted, count(*) FILTER (WHERE checked_in_at IS NOT NULL)::int AS checked_in FROM registrations WHERE event_id = $1`, [e.id])
  const origin = await appOrigin()
  const local = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 16) : '')
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
      <section className="card mb-8 p-5" data-testid="my-event-relationships">
        <h2 className="h2">Your relationships from this event</h2>
        <p className="mt-1 text-sm text-ink-muted">People you met here: <b className="text-navy-900">{mine.people}</b> · with a note: <b className="text-navy-900">{mine.noted}</b> · follow-ups open: <b className="text-navy-900">{mine.followups}</b></p>
        {mine.people > 0 && <Link href={`/connections?q=${encodeURIComponent(e.name)}`} className="btn-more mt-3 w-full sm:w-auto">See them in People</Link>}
      </section>
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <Link href={`/events/${e.id}/registrations`} className="card flex min-h-[64px] items-center gap-3 px-5 hover:border-electric-400" data-testid="link-registrations"><ClipboardList className="h-5 w-5 text-electric" aria-hidden="true" /> <span className="flex-1 font-semibold">Registrations</span><span className="text-sm text-ink-muted">{reg.confirmed} confirmed · {reg.waitlisted} waitlist</span></Link>
        <Link href={`/events/${e.id}/checkin`} className="card flex min-h-[64px] items-center gap-3 px-5 hover:border-electric-400" data-testid="link-checkin"><ScanLine className="h-5 w-5 text-electric" aria-hidden="true" /> <span className="flex-1 font-semibold">Check-in</span><span className="text-sm text-ink-muted">{reg.checked_in} in</span></Link>
        <Link href={`/events/${e.id}/participants`} className="card flex min-h-[64px] items-center gap-3 px-5 hover:border-electric-400"><Users className="h-5 w-5 text-electric" aria-hidden="true" /> <span className="font-semibold">Participants</span></Link>
        <Link href={`/stations?org=${e.org_id}`} className="card flex min-h-[64px] items-center gap-3 px-5 hover:border-electric-400"><QrCode className="h-5 w-5 text-electric" aria-hidden="true" /> <span className="font-semibold">Stations & QR codes</span></Link>
      </div>
      <h2 className="h2 mb-3"><Globe className="mr-1 inline h-5 w-5 text-electric" aria-hidden="true" /> Public page & registration</h2>
      {pub.published && pub.slug && <p className="mb-3 rounded-2xl bg-soft-100 px-4 py-3 text-sm" data-testid="public-url">Live at <a href={`/e/${pub.slug}`} target="_blank" rel="noopener" className="font-semibold text-electric-600 underline">{origin}/e/{pub.slug}</a> · put this link on a station in “Event registration” mode for walk-ups.</p>}
      <ActionForm action={eventDetailsAction} className="card mb-8 space-y-4 p-5" id="public">
        <input type="hidden" name="id" value={e.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="slug">Web address</label><div className="flex items-center gap-1"><span className="text-sm text-ink-muted">/e/</span><input dir="ltr" id="slug" name="slug" defaultValue={pub.slug ?? ''} className="input mt-0 flex-1" maxLength={60} placeholder="carmel-summit-2026" /></div></div>
          <div><label className="label" htmlFor="timezone">Timezone</label><input dir="ltr" id="timezone" name="timezone" defaultValue={pub.timezone} className="input" placeholder="Asia/Jerusalem" /></div>
          <div><label className="label" htmlFor="startsAt">Starts</label><input id="startsAt" name="startsAt" type="datetime-local" defaultValue={local(pub.starts_at)} className="input" /></div>
          <div><label className="label" htmlFor="endsAt">Ends</label><input id="endsAt" name="endsAt" type="datetime-local" defaultValue={local(pub.ends_at)} className="input" /></div>
          <div><label className="label" htmlFor="capacity">Capacity <span className="font-normal text-ink-muted">(blank = unlimited)</span></label><input id="capacity" name="capacity" type="number" min={1} defaultValue={pub.capacity ?? ''} className="input" /></div>
        </div>
        <div><label className="label" htmlFor="description">Description</label><textarea dir="auto" id="description" name="description" defaultValue={pub.description} className="input min-h-[100px] py-3" maxLength={4000} /></div>
        <div><label className="label" htmlFor="registrationFields">Extra questions <span className="font-normal text-ink-muted">— one per line: Label | text/select/checkbox | required | option;option</span></label>
          <textarea dir="auto" id="registrationFields" name="registrationFields" className="input min-h-[70px] py-3 font-mono text-sm" defaultValue={pub.registration_fields.map((f) => [f.label, f.kind, f.required ? 'required' : '', (f.options ?? []).join(';')].join(' | ')).join('\n')} placeholder={'Dietary needs | select | | None;Vegetarian;Vegan\nI agree to the code of conduct | checkbox | required'} /></div>
        <div><label className="label" htmlFor="ticketTypes">Ticket types <span className="font-normal text-ink-muted">— one per line: Name | price label (blank = free) | quantity</span></label>
          <textarea dir="auto" id="ticketTypes" name="ticketTypes" className="input min-h-[60px] py-3 font-mono text-sm" defaultValue={pub.ticket_types.map((t) => [t.name, t.price_label ?? '', t.quantity ?? ''].join(' | ')).join('\n')} placeholder={'General | | 200\nVIP | ₪490 | 20'} />
          <p className="hint mt-1">Priced tickets are stored but cannot be sold until a payment provider is configured — they show as “not on sale yet”.</p></div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex min-h-[44px] items-center gap-3"><input type="checkbox" name="published" defaultChecked={pub.published} className="h-5 w-5 accent-electric" data-testid="publish-toggle" /> Published</label>
          <label className="flex min-h-[44px] items-center gap-3"><input type="checkbox" name="registrationOpen" defaultChecked={pub.registration_open} className="h-5 w-5 accent-electric" /> Registration open</label>
          <label className="flex min-h-[44px] items-center gap-3"><input type="checkbox" name="waitlist" defaultChecked={pub.waitlist} className="h-5 w-5 accent-electric" /> Waitlist when full</label>
        </div>
        <Submit>Save public page</Submit>
      </ActionForm>
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
