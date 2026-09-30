import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, ChevronLeft, Circle, Trash2 } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { getConnection } from '@/lib/server/services/connections'
import { AppError } from '@/lib/server/errors'
import { getDb } from '@/lib/server/db'
import { has, userPlan } from '@/lib/server/plans'
import { addFollowUpAction, addNoteAction, archiveConnectionAction, deleteNoteAction, toggleFollowUpAction, updateContextAction } from '@/app/actions/connections'
import { ActionForm, Submit } from '@/components/Forms'
import { FieldIcon } from '@/components/FieldIcon'
import { PlanGate, PrivateBadge, fmtDate, relTime } from '@/components/ui'
import { hrefForField, type FieldKind } from '@/lib/capsule-model'

export const metadata = { title: 'Contact' }

export default async function ContactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; kept?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const user = await requireUser()
  const data = await getConnection(user.id, id).catch((e) => { if (e instanceof AppError) return null; throw e })
  if (!data) notFound()
  const { connection: c, notes, followUps } = data
  const plan = await userPlan(await getDb(), user.id)
  const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10)

  return (
    <>
      <Link href="/connections" className="btn-quiet mb-2 -ml-2"><ChevronLeft className="h-5 w-5" aria-hidden="true" /> Connections</Link>
      {(sp.new || sp.kept) && <p className="card mb-4 border-electric/30 bg-soft-100 px-4 py-3 font-medium text-navy-900" data-testid="connection-banner">{sp.new ? `You’re connected with ${c.name}.` : `Kept. ${c.name.split(' ')[0]} is in your ORYN now.`}</p>}

      <header className="card overflow-hidden">
        <div className="bg-navy-900 px-5 py-5 text-white">
          <h1 className="text-2xl font-bold" data-testid="contact-name">{c.name}</h1>
          {c.headline && <p className="text-soft-200">{c.headline}</p>}
          <p className="mt-2 text-sm text-soft-300">Met {c.event_name ? `at ${c.event_name}` : c.met_where ? `· ${c.met_where}` : ''} · {relTime(c.met_at)}</p>
        </div>
        <ul className="space-y-2 p-4">
          {c.contact.map((f, i) => {
            const href = hrefForField({ kind: f.kind as FieldKind, value: f.value })
            const Row = (
              <><span className="grid h-10 w-10 place-items-center rounded-xl bg-soft-100 text-electric-600"><FieldIcon kind={f.kind as FieldKind} /></span>
                <span className="min-w-0"><span className="block text-xs font-semibold text-ink-muted">{f.label}</span><span className="block truncate font-medium">{f.value}</span></span></>
            )
            return <li key={i}>{href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="flex min-h-[56px] items-center gap-3 rounded-xl px-2 hover:bg-soft-50">{Row}</a> : <div className="flex min-h-[56px] items-center gap-3 px-2">{Row}</div>}</li>
          })}
        </ul>
      </header>

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
                    <span className={`flex-1 ${f.done_at ? 'text-ink-muted line-through' : 'font-medium'}`}>{f.title}</span>
                    <span className="text-sm text-ink-muted">{fmtDate(f.due_on)}</span>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addFollowUpAction} className="card grid gap-3 p-4 sm:grid-cols-[1fr_170px_auto] sm:items-end" resetOnSuccess>
              <input type="hidden" name="connectionId" value={c.id} />
              <div><label className="label" htmlFor="title">What to do</label><input id="title" name="title" className="input" placeholder="Send the deck" maxLength={120} data-testid="followup-title" /></div>
              <div><label className="label" htmlFor="dueOn">When</label><input id="dueOn" name="dueOn" type="date" className="input" defaultValue={tomorrow} /></div>
              <Submit className="btn-share" pendingText="Saving…">Set</Submit>
            </ActionForm>
          </>
        )}
      </section>

      <section className="mt-8" aria-labelledby="notes">
        <div className="mb-3 flex items-center justify-between"><h2 id="notes" className="h2">Private notes</h2><PrivateBadge /></div>
        {!has(plan, 'notes.private') ? <PlanGate message="Private notes are part of Pro." /> : (
          <>
            <ActionForm action={addNoteAction} className="card p-4" resetOnSuccess>
              <input type="hidden" name="connectionId" value={c.id} />
              <label htmlFor="body" className="sr-only">New note</label>
              <textarea id="body" name="body" className="input mt-0 min-h-[90px] py-3" placeholder={`What do you want to remember about ${c.name.split(' ')[0]}?`} maxLength={4000} data-testid="note-body" />
              <div className="mt-3"><Submit className="btn-save w-full" pendingText="Saving…">Save note</Submit></div>
            </ActionForm>
            <ul className="mt-3 space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="card flex gap-3 px-4 py-3" data-testid="note">
                  <p className="flex-1 whitespace-pre-wrap text-[15px]">{n.body}<span className="mt-1 block text-xs text-ink-muted">{relTime(n.created_at)}</span></p>
                  <form action={deleteNoteAction}><input type="hidden" name="id" value={n.id} /><input type="hidden" name="connectionId" value={c.id} /><button className="grid h-10 w-10 place-items-center rounded-xl text-ink-faint hover:text-signal-stop" aria-label="Delete note"><Trash2 className="h-4 w-4" /></button></form>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="mt-8">
        <h2 className="h2 mb-3">Where you met</h2>
        <ActionForm action={updateContextAction} className="card flex gap-2 p-4">
          <input type="hidden" name="connectionId" value={c.id} />
          <label htmlFor="metWhere" className="sr-only">Where you met</label>
          <input id="metWhere" name="metWhere" defaultValue={c.met_where} className="input mt-0 flex-1" maxLength={120} />
          <Submit className="btn-more" pendingText="…">Save</Submit>
        </ActionForm>
      </section>

      <form action={archiveConnectionAction} className="mt-10 border-t border-soft-200 pt-6">
        <input type="hidden" name="id" value={c.id} />
        <button className="btn-quiet text-signal-stop">Remove from my connections</button>
      </form>
    </>
  )
}
