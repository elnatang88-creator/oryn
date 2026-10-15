import Link from 'next/link'
import { CalendarDays, CheckCircle2, MapPin } from 'lucide-react'
import { ticketByToken } from '@/lib/server/services/registrations'
import { qrSvg } from '@/lib/server/services/owner-card'
import { appOrigin } from '@/lib/server/request'
import { cancelRegistrationAction } from '@/app/actions/public'
import { RecipientFrame, Unavailable } from '@/components/Recipient'
import { LogoMark } from '@/components/Logo'
import { fmtWhen } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your ticket', robots: { index: false, follow: false } }

/** The ticket: a QR that encodes this very URL, the essentials, and the status. Nothing else to understand. */
export default async function TicketPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ new?: string; again?: string; cancelled?: string }> }) {
  const [{ token }, sp] = await Promise.all([params, searchParams])
  const t = await ticketByToken(token)
  if (!t) return <Unavailable status="not_found" />
  const url = `${await appOrigin()}/ticket/${token}`
  const svg = await qrSvg(url)
  const type = t.ticket_types.find((x) => x.id === t.ticket_type_id)
  // Ticket states: Valid · Checked in · Cancelled · Expired (the event ended and this ticket was never used) · Waitlisted.
  const ended = t.ends_at ? new Date(t.ends_at).getTime() < Date.now() : t.starts_at ? new Date(t.starts_at).getTime() + 24 * 3600_000 < Date.now() : false
  const state = t.status === 'cancelled' ? 'cancelled' : t.checked_in_at ? 'used' : ended ? 'expired' : t.status === 'waitlisted' ? 'waitlisted' : 'valid'
  const STATE_LABEL: Record<typeof state, string> = { valid: 'Valid', used: 'Checked in', cancelled: 'Cancelled', expired: 'Expired', waitlisted: 'Waitlisted' }
  return (
    <RecipientFrame>
      {sp.new && (state === 'valid' || state === 'waitlisted') && <p className="mb-3 rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-signal-ok" data-testid="ticket-new">{state === 'waitlisted' ? 'You’re on the waitlist.' : 'You’re registered. This is your ticket.'}</p>}
      {sp.again && <p className="mb-3 rounded-2xl bg-soft-100 px-4 py-3 text-center text-sm font-semibold text-navy-900">You were already registered — here’s your ticket again.</p>}
      {sp.cancelled && <p className="mb-3 rounded-2xl bg-soft-100 px-4 py-3 text-center text-sm font-semibold text-navy-900">{state === 'cancelled' ? 'Your registration is cancelled.' : 'This registration couldn’t be cancelled.'}</p>}
      <article className="overflow-hidden rounded-capsule bg-white shadow-capsule" data-testid="ticket" data-state={state}>
        <div className="flex items-start justify-between bg-navy-950 px-6 py-5 text-white">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric-300">{t.org_name}</p>
            <h1 dir="auto" className="mt-1 text-2xl font-bold leading-tight">{t.event_name}</h1>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2"><LogoMark size={26} className="opacity-80" /><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${state === 'valid' ? 'bg-emerald-400/20 text-emerald-200' : state === 'used' ? 'bg-electric/30 text-electric-300' : 'bg-white/10 text-soft-200'}`} data-testid="ticket-state">{STATE_LABEL[state]}</span></div>
        </div>
        <div className="px-6 py-5">
          <p dir="auto" className="text-xl font-bold text-navy-900" data-testid="ticket-name">{t.name}</p>
          <p dir="auto" className="text-sm text-ink-muted">{[t.company, type?.name].filter(Boolean).join(' · ')}</p>
          <ul className="mt-3 space-y-1 text-[15px]">
            {t.starts_at && <li className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-electric" aria-hidden="true" />{fmtWhen(t.starts_at, t.ends_at, t.timezone)}</li>}
            {t.venue && <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-electric" aria-hidden="true" /><span dir="auto">{t.venue}</span></li>}
          </ul>
        </div>
        <div className="border-t border-dashed border-soft-300 px-6 py-6 text-center">
          {state === 'valid' && (
            <>
              <div className="mx-auto w-full max-w-[260px] rounded-2xl bg-white p-2 ring-1 ring-soft-200" role="img" aria-label="Your ticket code" data-testid="ticket-qr" dangerouslySetInnerHTML={{ __html: svg }} />
              <p className="mt-3 text-sm font-semibold text-navy-900">Show this at the door</p>
              <p className="text-xs text-ink-muted">Registration {t.id.replace(/^reg_/, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase()}</p>
            </>
          )}
          {state === 'used' && <p className="flex items-center justify-center gap-2 text-lg font-bold text-signal-ok" data-testid="ticket-used"><CheckCircle2 className="h-6 w-6" aria-hidden="true" /> Checked in · {new Date(t.checked_in_at!).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</p>}
          {state === 'waitlisted' && <p className="text-lg font-bold text-navy-900">On the waitlist</p>}
          {state === 'cancelled' && <p className="text-lg font-bold text-ink-muted">Cancelled</p>}
          {state === 'expired' && <p className="text-lg font-bold text-ink-muted" data-testid="ticket-expired">Expired · the event has ended</p>}
        </div>
        {(state === 'valid' || state === 'waitlisted') && (
          <form action={cancelRegistrationAction} className="border-t border-soft-100 px-6 py-3 text-center">
            <input type="hidden" name="token" value={token} />
            <button className="btn-quiet text-sm text-signal-stop" data-testid="ticket-cancel">Cancel my registration</button>
          </form>
        )}
      </article>
      <p className="mt-4 text-center text-sm text-ink-muted">Add this page to your home screen to keep the ticket handy. <Link href={`/e/${t.slug}`} className="underline">Event details</Link></p>
    </RecipientFrame>
  )
}
