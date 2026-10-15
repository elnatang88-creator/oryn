import Link from 'next/link'
import { CalendarDays, MapPin, Users } from 'lucide-react'
import { publicEvent } from '@/lib/server/services/registrations'
import { RecipientFrame, Unavailable } from '@/components/Recipient'
import { fmtWhen } from '@/lib/format'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const e = await publicEvent((await params).slug)
  return { title: e ? `${e.name} · ORYN Events` : 'Event', robots: { index: !!e, follow: false } }
}

/** The public event page: what, when, where, and one obvious action. No account needed. */
export default async function PublicEventPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ station?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const e = await publicEvent(slug)
  if (!e) return <Unavailable status="not_found" />
  const full = e.capacity != null && e.confirmed >= e.capacity
  const open = e.registration_open && e.status !== 'ended'
  return (
    <RecipientFrame>
      <article className="overflow-hidden rounded-capsule bg-white shadow-capsule" data-testid="public-event">
        <div className="bg-navy-950 px-6 py-7 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-electric-300">{e.org_name}</p>
          <h1 dir="auto" className="mt-2 text-3xl font-bold leading-tight">{e.name}</h1>
          <ul className="mt-4 space-y-1.5 text-[15px] text-soft-100">
            {e.starts_at && <li className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-electric-300" aria-hidden="true" />{fmtWhen(e.starts_at, e.ends_at, e.timezone)}</li>}
            {e.venue && <li className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-electric-300" aria-hidden="true" /><span dir="auto">{e.venue}</span></li>}
            {e.capacity != null && <li className="flex items-center gap-2"><Users className="h-4 w-4 shrink-0 text-electric-300" aria-hidden="true" />{full ? 'Full — waitlist open' : `${e.capacity - e.confirmed} places left`}</li>}
          </ul>
        </div>
        {e.description && <p dir="auto" className="whitespace-pre-wrap px-6 py-5 text-[16px] leading-relaxed text-ink">{e.description}</p>}
        <div className="px-6 pb-6">
          {e.status === 'ended' ? <p className="rounded-2xl bg-soft-100 px-4 py-3 text-center font-semibold text-ink-muted" data-testid="event-ended">This event has ended.</p>
            : !open ? <p className="rounded-2xl bg-soft-100 px-4 py-3 text-center font-semibold text-ink-muted" data-testid="registration-closed">Registration is closed.</p>
            : <Link href={`/register/${e.slug}${sp.station ? `?station=${encodeURIComponent(sp.station)}` : ''}`} className="btn-share w-full text-[17px]" data-testid="register-cta">{full && e.waitlist ? 'Join the waitlist' : 'Register — it’s free'}</Link>}
        </div>
      </article>
    </RecipientFrame>
  )
}
