import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, ChevronLeft, Circle, Mail, Phone } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { getLead } from '@/lib/server/services/crm'
import { AppError } from '@/lib/server/errors'
import { addLeadNoteAction, createTaskAction, toggleTaskAction, updateLeadAction } from '@/app/actions/workspace'
import { ActionForm, Submit } from '@/components/Forms'
import { AiAssist } from '@/components/AiAssist'
import { PageHeader, fmtDate, relTime } from '@/components/ui'

export const metadata = { title: 'Lead' }

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const data = await getLead(user.id, id).catch((e) => { if (e instanceof AppError) return null; throw e })
  if (!data) notFound()
  const { lead: l, notes, tasks, members, stages } = data
  const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10)
  return (
    <>
      <Link href={`/business?org=${l.org_id}`} className="btn-quiet -ml-2 mb-2"><ChevronLeft className="h-5 w-5" aria-hidden="true" /> Pipeline</Link>
      <PageHeader title={l.name} sub={[l.company, l.source === 'station' ? `from station ${l.station_name ?? ''}` : `source: ${l.source}`, l.event_name, `added ${relTime(l.created_at)}`].filter(Boolean).join(' · ')} />
      <div className="mb-4 flex flex-wrap gap-2">
        {l.email && <a href={`mailto:${l.email}`} className="btn-more"><Mail className="h-5 w-5" aria-hidden="true" /> {l.email}</a>}
        {l.phone && <a href={`tel:${l.phone.replace(/[^+\d]/g, '')}`} className="btn-more"><Phone className="h-5 w-5" aria-hidden="true" /> {l.phone}</a>}
        {!l.consent_at && <span className="chip-muted">No contact consent recorded</span>}
      </div>
      {l.message && <p dir="auto" className="card mb-4 whitespace-pre-wrap px-4 py-3 text-[15px]" data-testid="lead-message">{l.message}</p>}
      <ActionForm action={updateLeadAction} className="card grid gap-3 p-4 sm:grid-cols-3">
        <input type="hidden" name="id" value={l.id} />
        <div><label className="label" htmlFor="stage">Stage</label><select id="stage" name="stage" defaultValue={l.stage} className="input" data-testid="lead-stage-select">{stages.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label className="label" htmlFor="assignee">Assigned to</label><select id="assignee" name="assignee" defaultValue={l.assignee_user_id ?? ''} className="input" data-testid="lead-assignee"><option value="">Nobody yet</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        <div><label className="label" htmlFor="tags">Tags <span className="font-normal text-ink-muted">(comma-separated)</span></label><input dir="auto" id="tags" name="tags" defaultValue={l.tags.join(', ')} className="input" /></div>
        <div className="sm:col-span-3"><Submit className="btn-save w-full sm:w-auto">Save</Submit></div>
      </ActionForm>
      <AiAssist kind="lead_summary" subjectId={l.id} label="Summarize this lead" />
      <section className="mt-8">
        <h2 className="h2 mb-3">Tasks</h2>
        {tasks.length > 0 && (
          <ul className="card mb-3 divide-y divide-soft-100" data-testid="lead-tasks">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 px-3 py-2">
                <form action={toggleTaskAction}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="leadId" value={l.id} /><input type="hidden" name="done" value={t.done_at ? 'false' : 'true'} />
                  <button className={`grid h-11 w-11 place-items-center rounded-xl ${t.done_at ? 'text-signal-ok' : 'text-ink-faint hover:text-signal-ok'}`} aria-label={t.done_at ? 'Mark not done' : 'Mark done'}>{t.done_at ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}</button></form>
                <span dir="auto" className={`flex-1 ${t.done_at ? 'text-ink-muted line-through' : 'font-medium'}`}>{t.title}{t.assignee ? <span className="text-xs text-ink-muted"> · {t.assignee}</span> : null}</span>
                {t.due_on && <span className="text-sm text-ink-muted">{fmtDate(t.due_on)}</span>}
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={createTaskAction} className="card grid gap-3 p-4 sm:grid-cols-[1fr_160px_160px_auto] sm:items-end" resetOnSuccess>
          <input type="hidden" name="orgId" value={l.org_id} /><input type="hidden" name="leadId" value={l.id} />
          <div><label className="label" htmlFor="title">Task</label><input dir="auto" id="title" name="title" className="input" placeholder="Send the proposal" maxLength={120} data-testid="task-title" /></div>
          <div><label className="label" htmlFor="dueOn">Due</label><input id="dueOn" name="dueOn" type="date" className="input" defaultValue={tomorrow} /></div>
          <div><label className="label" htmlFor="tassignee">Who</label><select id="tassignee" name="assignee" className="input" defaultValue={l.assignee_user_id ?? user.id}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          <Submit className="btn-share">Add</Submit>
        </ActionForm>
      </section>
      <section className="mt-8">
        <h2 className="h2 mb-3">Notes</h2>
        <ActionForm action={addLeadNoteAction} className="card p-4" resetOnSuccess>
          <input type="hidden" name="id" value={l.id} />
          <label htmlFor="body" className="sr-only">New note</label>
          <textarea dir="auto" id="body" name="body" className="input mt-0 min-h-[80px] py-3" placeholder="What was said, what they need, next step" maxLength={4000} data-testid="lead-note" />
          <div className="mt-2"><Submit className="btn-save w-full">Save note</Submit></div>
        </ActionForm>
        <ul className="mt-3 space-y-2">{notes.map((n) => <li key={n.id} className="card px-4 py-3"><p dir="auto" className="whitespace-pre-wrap text-[15px]">{n.body}</p><p className="mt-1 text-xs text-ink-muted">{n.author ?? 'Automation'} · {relTime(n.created_at)}</p></li>)}</ul>
      </section>
    </>
  )
}
