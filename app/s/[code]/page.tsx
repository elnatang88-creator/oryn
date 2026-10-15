import { redirect } from 'next/navigation'
import { ArrowUpRight, CalendarCheck, ShieldCheck } from 'lucide-react'
import { resolveStation } from '@/lib/server/services/stations'
import { submitLeadAction } from '@/app/actions/public'
import { ActionForm, Submit } from '@/components/Forms'
import { RecipientFrame, Unavailable } from '@/components/Recipient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'ORYN', robots: { index: false, follow: false } }

/**
 * ORYN Station: one printed https URL (NFC tag and QR code alike). What it does is whatever the owner set last.
 * card → the station's card · registration → the event's registration · check-in → staff scanner (sign-in) ·
 * lead → a short consent-based form · booking/link → a branded hand-off to an https destination (never auto-redirected
 * to an external site, so a tapped tag can't silently send someone elsewhere).
 */
export default async function StationPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const s = await resolveStation(code)
  if (s.status !== 'ok') return <Unavailable status={s.status} />
  if (s.mode === 'card' && s.token) redirect(`/c/${s.token}`)
  if (s.mode === 'registration' && s.eventSlug) redirect(`/e/${s.eventSlug}?station=${code}`)
  if (s.mode === 'checkin' && s.eventId) redirect(`/events/${s.eventId}/checkin`)
  if ((s.mode === 'booking' || s.mode === 'link') && s.destinationUrl) {
    const host = new URL(s.destinationUrl).hostname
    return (
      <RecipientFrame>
        <article className="mt-10 rounded-capsule bg-white p-7 text-center shadow-capsule" data-testid="station-handoff">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric-600">{s.orgName}</p>
          <h1 dir="auto" className="mt-2 text-2xl font-bold text-navy-900">{s.config.headline || (s.mode === 'booking' ? 'Book a meeting' : s.stationName)}</h1>
          {s.config.prompt && <p dir="auto" className="mt-2 text-ink-muted">{s.config.prompt}</p>}
          <a href={s.destinationUrl} rel="noopener noreferrer" className="btn-share mt-6 w-full text-[17px]" data-testid="station-continue">{s.mode === 'booking' ? <CalendarCheck className="h-5 w-5" aria-hidden="true" /> : <ArrowUpRight className="h-5 w-5" aria-hidden="true" />} Continue to {host}</a>
          <p className="mt-3 flex items-center justify-center gap-1 text-xs text-ink-muted"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Secure link set by {s.orgName}</p>
        </article>
      </RecipientFrame>
    )
  }
  if (s.mode === 'lead') {
    return (
      <RecipientFrame>
        <article className="rounded-capsule bg-white p-6 shadow-capsule" data-testid="station-lead">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric-600">{s.orgName}</p>
          <h1 dir="auto" className="mt-1 text-2xl font-bold text-navy-900">{s.config.headline || 'Leave your details'}</h1>
          <p dir="auto" className="mt-1 text-ink-muted">{s.config.prompt || `${s.orgName} will get back to you. Share only what you want.`}</p>
          <ActionForm action={submitLeadAction} className="mt-5 space-y-3" resetOnSuccess>
            <input type="hidden" name="station" value={code} />
            <div><label className="label" htmlFor="name">Name</label><input dir="auto" id="name" name="name" autoComplete="name" className="input" required maxLength={80} /></div>
            <div><label className="label" htmlFor="email">Email</label><input dir="auto" id="email" name="email" type="email" autoComplete="email" className="input" /></div>
            <div><label className="label" htmlFor="phone">Phone <span className="font-normal text-ink-muted">(optional)</span></label><input dir="auto" id="phone" name="phone" type="tel" autoComplete="tel" className="input" maxLength={40} /></div>
            <div><label className="label" htmlFor="company">Company <span className="font-normal text-ink-muted">(optional)</span></label><input dir="auto" id="company" name="company" autoComplete="organization" className="input" maxLength={80} /></div>
            <div><label className="label" htmlFor="message">What are you interested in? <span className="font-normal text-ink-muted">(optional)</span></label><textarea dir="auto" id="message" name="message" className="input min-h-[80px] py-3" maxLength={2000} /></div>
            <label className="flex min-h-[44px] items-start gap-3 text-sm"><input type="checkbox" name="consent" className="mt-1 h-5 w-5 accent-electric" required /><span>{s.orgName} may contact me about this. My details are used for that only.</span></label>
            <Submit pendingText="Sending…">Send to {s.orgName}</Submit>
          </ActionForm>
        </article>
      </RecipientFrame>
    )
  }
  if (s.token) redirect(`/c/${s.token}`)
  return <Unavailable status="not_found" />
}
