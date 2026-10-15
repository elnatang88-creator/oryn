import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { publicEvent } from '@/lib/server/services/registrations'
import { currentUser } from '@/lib/server/request'
import { registerAction } from '@/app/actions/public'
import { ActionForm, Submit } from '@/components/Forms'
import { RecipientFrame, Unavailable } from '@/components/Recipient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Register', robots: { index: false, follow: false } }

export default async function RegisterPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ station?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const e = await publicEvent(slug)
  if (!e) return <Unavailable status="not_found" />
  const me = await currentUser()
  const full = e.capacity != null && e.confirmed >= e.capacity
  const closed = !e.registration_open || e.status === 'ended' || (full && !e.waitlist)
  const freeTypes = e.ticket_types.filter((t) => !t.price_label)
  const paidTypes = e.ticket_types.filter((t) => t.price_label)
  return (
    <RecipientFrame>
      <Link href={`/e/${e.slug}`} className="btn-quiet -ml-2 mb-2"><ChevronLeft className="h-5 w-5" aria-hidden="true" /> {e.name}</Link>
      <article className="rounded-capsule bg-white p-6 shadow-capsule">
        <h1 className="text-2xl font-bold text-navy-900">{full ? 'Join the waitlist' : 'Register'}</h1>
        <p className="mt-1 text-ink-muted">{full ? 'The event is full. We’ll email you if a place opens.' : 'Your ticket arrives by email, and right here.'}</p>
        {closed ? <p className="mt-6 rounded-2xl bg-soft-100 px-4 py-3 text-center font-semibold text-ink-muted">Registration is closed.</p> : (
          <ActionForm action={registerAction} className="mt-6 space-y-4">
            <input type="hidden" name="slug" value={e.slug} />
            {sp.station && <input type="hidden" name="station" value={sp.station} />}
            <div><label className="label" htmlFor="name">Your name</label><input dir="auto" id="name" name="name" autoComplete="name" className="input" required maxLength={80} defaultValue={me?.display_name ?? ''} /></div>
            <div><label className="label" htmlFor="email">Email</label><input dir="auto" id="email" name="email" type="email" autoComplete="email" className="input" required defaultValue={me?.email ?? ''} /></div>
            <div><label className="label" htmlFor="company">Company <span className="font-normal text-ink-muted">(optional)</span></label><input dir="auto" id="company" name="company" autoComplete="organization" className="input" maxLength={80} /></div>
            {freeTypes.length > 1 && (
              <div><label className="label" htmlFor="ticketType">Ticket</label>
                <select id="ticketType" name="ticketType" className="input">{freeTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            )}
            {paidTypes.length > 0 && <p className="hint">Paid tickets ({paidTypes.map((t) => t.name).join(', ')}) aren’t on sale yet.</p>}
            {e.registration_fields.map((f) => (
              <div key={f.id}>
                {f.kind === 'checkbox' ? (
                  <label className="flex min-h-[44px] items-center gap-3"><input type="checkbox" name={`q_${f.id}`} className="h-5 w-5 accent-electric" required={f.required} /><span>{f.label}{f.required ? ' *' : ''}</span></label>
                ) : f.kind === 'select' ? (
                  <><label className="label" htmlFor={`q_${f.id}`}>{f.label}{f.required ? ' *' : ''}</label>
                    <select id={`q_${f.id}`} name={`q_${f.id}`} className="input" required={f.required}><option value="">Choose…</option>{(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}</select></>
                ) : (
                  <><label className="label" htmlFor={`q_${f.id}`}>{f.label}{f.required ? ' *' : ''}</label><input dir="auto" id={`q_${f.id}`} name={`q_${f.id}`} className="input" required={f.required} maxLength={500} /></>
                )}
              </div>
            ))}
            <Submit pendingText="Registering…">{full ? 'Join the waitlist' : 'Register'}</Submit>
            <p className="text-center text-xs text-ink-muted">{e.org_name} receives your name and email for this event only.</p>
          </ActionForm>
        )}
      </article>
    </RecipientFrame>
  )
}
