import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BellPlus, CalendarDays, CheckCircle2, ChevronLeft, Circle, Eye, Mail, MessageSquareText, NotebookPen, Phone, Radar, Trash2, UserRound } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { getConnection } from '@/lib/server/services/connections'
import { AppError } from '@/lib/server/errors'
import { getDb } from '@/lib/server/db'
import { has, userPlan } from '@/lib/server/plans'
import { addFollowUpAction, addNoteAction, archiveConnectionAction, deleteNoteAction, quickFollowUpFormAction, setTagsAction, toggleFollowUpAction, updateContextAction } from '@/app/actions/connections'
import { SUGGESTED_TAGS } from '@/lib/server/services/connections'
import { CardStage } from '@/components/CardStage'
import { CardFace, DetailsBack } from '@/components/LuxuryCard'
import { normalizeDesign } from '@/lib/card-design'
import { TrackOnMount } from '@/components/TrackOnMount'
import { ActionForm, Submit } from '@/components/Forms'
import { FieldIcon } from '@/components/FieldIcon'
import { PlanGate, PrivateBadge, fmtDate, relTime } from '@/components/ui'
import { hrefForField, type FieldKind } from '@/lib/capsule-model'

export const metadata = { title: 'Person' }

const CHANNEL: Record<string, string> = { nearby: 'Nearby', qr: 'Your card (QR or link)', link: 'Your card link', web_share: 'Your card link', shortcut: 'Your card link', wallet_pass: 'Your Wallet pass', station: 'A station', kept: 'They gave you their card', manual: 'Added by you' }

export default async function ContactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; kept?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const user = await requireUser()
  const data = await getConnection(user.id, id).catch((e) => { if (e instanceof AppError) return null; throw e })
  if (!data) notFound()
  const { connection: c, notes, followUps, timeline } = data
  const plan = await userPlan(await getDb(), user.id)
  const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10)
  const first = c.name.split(' ')[0]
  const email = c.contact.find((f) => f.kind === 'email')?.value
  const phone = c.contact.find((f) => f.kind === 'phone')?.value
  const card = c.card ? { ...c.card, design: normalizeDesign(c.card.design) } : null
  // "Nearby" is how you connected, not where — don't repeat it as a place.
  const where = c.event_name ?? (c.met_where && c.met_where !== 'Nearby' ? c.met_where : null)

  return (
    <>
      <TrackOnMount name="person_opened" props={{ connection_id: c.id, channel: c.channel ?? undefined, surface: 'people' }} />
      <Link href="/connections" className="btn-quiet mb-2 -ml-2"><ChevronLeft className="h-5 w-5" aria-hidden="true" /> People</Link>
      {(sp.new || sp.kept) && <p className="card mb-4 border-electric/30 bg-soft-100 px-4 py-3 font-medium text-navy-900" data-testid="connection-banner">{sp.new ? `You’re connected with ${c.name}. Add a little context while it’s fresh.` : `Kept. ${first} is in your ORYN now.`}</p>}

      <header className="text-center">
        {card ? (
          <div className="mx-auto w-full max-w-[340px]" data-testid="person-card">
            <CardStage tone="light" surface="people" front={<CardFace design={card.design} identity={{ displayName: card.displayName, headline: card.headline, company: card.company, avatarUrl: null }} />}
              back={<DetailsBack design={card.design} name={card.displayName} details={c.contact} />} />
          </div>
        ) : (
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-navy-900 text-2xl font-bold text-white" aria-hidden="true"><UserRound className="h-9 w-9" /></span>
        )}
        <h1 dir="auto" className="mt-3 text-2xl font-bold text-navy-900" data-testid="contact-name">{c.name}</h1>
        {(c.headline || card?.company) && <p dir="auto" className="text-ink-muted">{[c.headline, card?.company].filter(Boolean).join(' · ')}</p>}
        {!card && <p className="mt-1 text-xs text-ink-muted">Shared a way to reach them — not an ORYN card.</p>}
      </header>

      <section id="context" className="card mt-5 divide-y divide-soft-100" aria-label="How you met" data-testid="person-context">
        <div className="flex items-center gap-3 px-4 py-3"><CalendarDays className="h-5 w-5 text-electric" aria-hidden="true" /><span className="flex-1"><span className="block text-xs font-semibold text-ink-muted">Met{where ? ' at' : ''}</span><span dir="auto" className={`block font-medium ${where ? '' : 'text-ink-muted'}`}>{where ?? 'Add where below'}</span></span><span className="text-sm text-ink-muted">{fmtDate(c.met_at)}</span></div>
        <div className="flex items-center gap-3 px-4 py-3"><Radar className="h-5 w-5 text-electric" aria-hidden="true" /><span className="flex-1"><span className="block text-xs font-semibold text-ink-muted">Connected via</span><span className="block font-medium">{CHANNEL[c.channel ?? ''] ?? (c.source === 'kept_capsule' ? CHANNEL.kept : 'ORYN')}</span></span></div>
        {c.my_card_name && <div className="flex items-center gap-3 px-4 py-3"><Eye className="h-5 w-5 text-electric" aria-hidden="true" /><span className="flex-1"><span className="block text-xs font-semibold text-ink-muted">You gave</span><span dir="auto" className="block font-medium">Your {c.my_card_name} card</span></span></div>}
      </section>

      <div className="mt-4 grid grid-cols-3 gap-2" data-testid="person-actions">
        {has(plan, 'followups') ? (
          <form action={quickFollowUpFormAction} className="contents">
            <input type="hidden" name="connectionId" value={c.id} /><input type="hidden" name="first" value={first} /><input type="hidden" name="when" value="day" />
            <button className="btn-more min-h-[56px] flex-col gap-0.5 rounded-2xl px-2 text-[13px]" data-testid="remind-tomorrow"><BellPlus className="h-5 w-5" aria-hidden="true" />Remind me tomorrow</button>
          </form>
        ) : <Link href="/settings/plan" className="btn-more min-h-[56px] flex-col gap-0.5 rounded-2xl px-2 text-[13px]"><BellPlus className="h-5 w-5" aria-hidden="true" />Reminders (Pro)</Link>}
        <a href="#notes" className="btn-more min-h-[56px] flex-col gap-0.5 rounded-2xl px-2 text-[13px]"><NotebookPen className="h-5 w-5" aria-hidden="true" />Add note</a>
        {email ? <a href={`mailto:${email}`} className="btn-more min-h-[56px] flex-col gap-0.5 rounded-2xl px-2 text-[13px]"><Mail className="h-5 w-5" aria-hidden="true" />Email {first}</a>
          : phone ? <a href={`sms:${phone.replace(/[^+\d]/g, '')}`} className="btn-more min-h-[56px] flex-col gap-0.5 rounded-2xl px-2 text-[13px]"><MessageSquareText className="h-5 w-5" aria-hidden="true" />Message</a>
          : <span className="btn-more min-h-[56px] flex-col gap-0.5 rounded-2xl px-2 text-[13px] opacity-60" aria-disabled="true"><Phone className="h-5 w-5" aria-hidden="true" />No channel shared</span>}
      </div>

      <section className="mt-8" aria-labelledby="shared">
        <h2 id="shared" className="h2 mb-3">What {first} shared</h2>
        <ul className="card space-y-1 p-2">
          {c.contact.length === 0 && <li className="px-3 py-3 text-sm text-ink-muted">Just a hello — nothing else was shared.</li>}
          {c.contact.map((f, i) => {
            const href = hrefForField({ kind: f.kind as FieldKind, value: f.value })
            const Row = (
              <><span className="grid h-10 w-10 place-items-center rounded-xl bg-soft-100 text-electric-600"><FieldIcon kind={f.kind as FieldKind} /></span>
                <span className="min-w-0"><span className="block text-xs font-semibold text-ink-muted">{f.label}</span><span dir="auto" className="block truncate font-medium">{f.value}</span></span></>
            )
            return <li key={i}>{href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="flex min-h-[56px] items-center gap-3 rounded-xl px-2 hover:bg-soft-50">{Row}</a> : <div className="flex min-h-[56px] items-center gap-3 px-2">{Row}</div>}</li>
          })}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="tags">
        <div className="mb-3 flex items-center justify-between"><h2 id="tags" className="h2">Tags</h2><PrivateBadge /></div>
        <ActionForm action={setTagsAction} className="card p-4">
          <input type="hidden" name="connectionId" value={c.id} />
          <div className="flex flex-wrap gap-2" data-testid="tag-options">
            {[...new Set([...SUGGESTED_TAGS, ...c.tags])].map((t) => (
              <label key={t} className="cursor-pointer">
                <input type="checkbox" name="tag" value={t} defaultChecked={c.tags.includes(t)} className="peer sr-only" />
                <span className="inline-flex min-h-[40px] items-center rounded-full border border-soft-300 px-3.5 text-sm font-semibold text-ink peer-checked:border-electric peer-checked:bg-electric peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-electric/25">{t}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <label htmlFor="custom" className="sr-only">Your own tag</label>
            <input dir="auto" id="custom" name="custom" maxLength={24} placeholder="Your own tag" className="input mt-0 flex-1" />
            <Submit className="btn-more" pendingText="…">Save</Submit>
          </div>
        </ActionForm>
      </section>

      <section className="mt-8" aria-labelledby="fu">
        <div className="mb-3 flex items-center justify-between"><h2 id="fu" className="h2">Follow-up</h2><PrivateBadge /></div>
        {!has(plan, 'followups') ? <PlanGate message="Reminders to follow up are part of Pro." /> : (
          <>
            {followUps.length > 0 && (
              <ul className="card mb-3 divide-y divide-soft-100">
                {followUps.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 px-3 py-2">
                    <form action={toggleFollowUpAction}>
                      <input type="hidden" name="id" value={f.id} /><input type="hidden" name="done" value={f.done_at ? 'false' : 'true'} /><input type="hidden" name="back" value={`/connections/${c.id}`} />
                      <button className={`grid h-11 w-11 place-items-center rounded-xl ${f.done_at ? 'text-signal-ok' : 'text-ink-faint hover:text-signal-ok'}`} aria-label={f.done_at ? 'Mark not done' : 'Mark done'}>{f.done_at ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}</button>
                    </form>
                    <span dir="auto" className={`flex-1 ${f.done_at ? 'text-ink-muted line-through' : 'font-medium'}`}>{f.title}</span>
                    <span className="text-sm text-ink-muted">{fmtDate(f.due_on)}</span>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addFollowUpAction} className="card grid gap-3 p-4 sm:grid-cols-[1fr_170px_auto] sm:items-end" resetOnSuccess>
              <input type="hidden" name="connectionId" value={c.id} />
              <div><label className="label" htmlFor="title">What to do</label><input dir="auto" id="title" name="title" className="input" placeholder="Send the deck" maxLength={120} data-testid="followup-title" /></div>
              <div><label className="label" htmlFor="dueOn">When</label><input dir="auto" id="dueOn" name="dueOn" type="date" className="input" defaultValue={tomorrow} /></div>
              <Submit className="btn-share" pendingText="Saving…">Set</Submit>
            </ActionForm>
          </>
        )}
      </section>

      <section id="notes" className="mt-8 scroll-mt-20" aria-labelledby="notes-h">
        <div className="mb-3 flex items-center justify-between"><h2 id="notes-h" className="h2">Private notes</h2><PrivateBadge /></div>
        {!has(plan, 'notes.private') ? <PlanGate message="Private notes are part of Pro." /> : (
          <>
            <ActionForm action={addNoteAction} className="card p-4" resetOnSuccess>
              <input type="hidden" name="connectionId" value={c.id} />
              <label htmlFor="body" className="sr-only">New note</label>
              <textarea dir="auto" id="body" name="body" className="input mt-0 min-h-[90px] py-3" placeholder={`What do you want to remember about ${c.name.split(' ')[0]}?`} maxLength={4000} data-testid="note-body" />
              <div className="mt-3"><Submit className="btn-save w-full" pendingText="Saving…">Save note</Submit></div>
            </ActionForm>
            <ul className="mt-3 space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="card flex gap-3 px-4 py-3" data-testid="note">
                  <p dir="auto" className="flex-1 whitespace-pre-wrap text-[15px]">{n.body}<span className="mt-1 block text-xs text-ink-muted">{relTime(n.created_at)}</span></p>
                  <form action={deleteNoteAction}><input type="hidden" name="id" value={n.id} /><input type="hidden" name="connectionId" value={c.id} /><button className="grid h-10 w-10 place-items-center rounded-xl text-ink-faint hover:text-signal-stop" aria-label="Delete note"><Trash2 className="h-4 w-4" /></button></form>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="mt-8">
        <h2 className="h2 mb-3">Where you met</h2>
        <p className="-mt-2 mb-2 text-sm text-ink-muted">Only you see this.</p>
        <ActionForm action={updateContextAction} className="card flex gap-2 p-4">
          <input type="hidden" name="connectionId" value={c.id} />
          <label htmlFor="metWhere" className="sr-only">Where you met</label>
          <input dir="auto" id="metWhere" name="metWhere" defaultValue={c.met_where} className="input mt-0 flex-1" maxLength={120} />
          <Submit className="btn-more" pendingText="…">Save</Submit>
        </ActionForm>
      </section>

      <section className="mt-8" aria-labelledby="history">
        <h2 id="history" className="h2 mb-3">History</h2>
        <ol className="card relative space-y-0 p-4" data-testid="timeline">
          {timeline.map((t, i) => (
            <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
              <span className="relative mt-1.5 flex flex-col items-center"><span className={`h-2.5 w-2.5 rounded-full ${t.kind === 'met' ? 'bg-electric' : t.kind === 'viewed_card' ? 'bg-emerald-500' : 'bg-soft-300'}`} />{i < timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-soft-200" />}</span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-ink-muted">{fmtDate(t.at)}</span><span dir="auto" className="block text-[15px]">{t.text}</span></span>
            </li>
          ))}
        </ol>
      </section>

      <form action={archiveConnectionAction} className="mt-10 border-t border-soft-200 pt-6">
        <input type="hidden" name="id" value={c.id} />
        <button className="btn-quiet text-signal-stop">Remove from my connections</button>
      </form>
    </>
  )
}
