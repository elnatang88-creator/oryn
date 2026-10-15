import Link from 'next/link'
import { CheckCircle2, ChevronLeft, Circle } from 'lucide-react'
import { listTasks } from '@/lib/server/services/crm'
import { createTaskAction, toggleTaskAction } from '@/app/actions/workspace'
import { ActionForm, Submit } from '@/components/Forms'
import { PageHeader, fmtDate } from '@/components/ui'
import { businessContext } from '../_org'

export const metadata = { title: 'Tasks' }

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ org?: string; all?: string }> }) {
  const sp = await searchParams
  const { user, org } = await businessContext(sp.org)
  const tasks = await listTasks(user.id, org.id, !sp.all)
  return (
    <>
      <Link href={`/business?org=${org.id}`} className="btn-quiet -ml-2 mb-2"><ChevronLeft className="h-5 w-5" aria-hidden="true" /> {org.name}</Link>
      <PageHeader title={sp.all ? 'All tasks' : 'My tasks'} action={<Link href={`/business/tasks?org=${org.id}${sp.all ? '' : '&all=1'}`} className="btn-quiet text-sm">{sp.all ? 'Only mine' : 'Everyone’s'}</Link>} />
      {tasks.length === 0 ? <p className="card px-4 py-4 text-ink-muted">Nothing to do. Nice.</p> : (
        <ul className="card divide-y divide-soft-100" data-testid="tasks">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2">
              <form action={toggleTaskAction}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="done" value={t.done_at ? 'false' : 'true'} />
                <button className={`grid h-11 w-11 place-items-center rounded-xl ${t.done_at ? 'text-signal-ok' : 'text-ink-faint hover:text-signal-ok'}`} aria-label={t.done_at ? 'Mark not done' : 'Mark done'}>{t.done_at ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}</button></form>
              <span className="min-w-0 flex-1"><span dir="auto" className={`block truncate ${t.done_at ? 'text-ink-muted line-through' : 'font-medium'}`}>{t.title}</span><span className="block truncate text-xs text-ink-muted">{[t.lead_name ? <Link key="l" href={`/business/leads/${t.lead_id}`} className="underline">{t.lead_name}</Link> : null, t.assignee].filter(Boolean).map((x, i) => <span key={i}>{i ? ' · ' : ''}{x}</span>)}</span></span>
              {t.due_on && <span className={`text-sm ${t.overdue ? 'font-semibold text-signal-warn' : 'text-ink-muted'}`}>{fmtDate(t.due_on)}</span>}
            </li>
          ))}
        </ul>
      )}
      <ActionForm action={createTaskAction} className="card mt-6 grid gap-3 p-4 sm:grid-cols-[1fr_160px_auto] sm:items-end" resetOnSuccess>
        <input type="hidden" name="orgId" value={org.id} />
        <div><label className="label" htmlFor="title">New task</label><input dir="auto" id="title" name="title" className="input" maxLength={120} /></div>
        <div><label className="label" htmlFor="dueOn">Due</label><input id="dueOn" name="dueOn" type="date" className="input" /></div>
        <Submit className="btn-share">Add</Submit>
      </ActionForm>
    </>
  )
}
