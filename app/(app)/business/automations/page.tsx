import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getDb } from '@/lib/server/db'
import { listAutomations, listRuns, TRIGGERS, TRIGGER_LABEL } from '@/lib/server/services/automations'
import { pipelineStages } from '@/lib/server/services/crm'
import { automationToggleAction, createAutomationAction } from '@/app/actions/workspace'
import { ActionForm, Submit } from '@/components/Forms'
import { PageHeader, relTime } from '@/components/ui'
import { emailTransport } from '@/lib/server/email'
import { businessContext } from '../_org'

export const metadata = { title: 'Automations' }

export default async function AutomationsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const sp = await searchParams
  const { user, org } = await businessContext(sp.org)
  const [autos, runs, stages, members] = await Promise.all([listAutomations(user.id, org.id), listRuns(user.id, org.id, 30), pipelineStages(org.id),
    (await getDb()).query<{ id: string; name: string }>(`SELECT u.id, u.display_name AS name FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = $1 ORDER BY u.display_name`, [org.id])])
  return (
    <>
      <Link href={`/business?org=${org.id}`} className="btn-quiet -ml-2 mb-2"><ChevronLeft className="h-5 w-5" aria-hidden="true" /> {org.name}</Link>
      <PageHeader title="Automations" sub="When something happens in this workspace, do the next step automatically. Every run is logged." />
      {emailTransport() === 'none' && <p className="card mb-4 border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Email actions are recorded but not delivered on this server (no email transport configured).</p>}
      {autos.length === 0 ? <p className="card px-4 py-4 text-ink-muted" data-testid="automations-empty">No automations yet. Start with “New lead → create a task for the assignee”.</p> : (
        <ul className="space-y-2" data-testid="automations">
          {autos.map((a) => (
            <li key={a.id} className="card px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1"><span dir="auto" className="block truncate font-semibold">{a.name}</span><span className="block truncate text-xs text-ink-muted">{TRIGGER_LABEL[a.trigger]}{Object.keys(a.conditions).length ? ` when ${Object.entries(a.conditions).map(([k, v]) => `${k} = ${v}`).join(', ')}` : ''} → {a.actions.map((x) => x.type.replace('_', ' ')).join(', ')} · {a.runs} runs{a.last_run ? `, last ${relTime(a.last_run)}` : ''}</span></span>
                <form action={automationToggleAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="enabled" value={a.enabled ? 'false' : 'true'} /><button className={`chip ${a.enabled ? 'bg-emerald-50 text-signal-ok' : 'chip-muted'}`}>{a.enabled ? 'On' : 'Off'}</button></form>
                <form action={automationToggleAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="delete" value="1" /><button className="btn-quiet text-sm text-signal-stop">Delete</button></form>
              </div>
            </li>
          ))}
        </ul>
      )}
      <h2 className="h2 mb-3 mt-8">New automation</h2>
      <ActionForm action={createAutomationAction} className="card grid gap-3 p-4 sm:grid-cols-2">
        <input type="hidden" name="orgId" value={org.id} />
        <div><label className="label" htmlFor="name">Name</label><input dir="auto" id="name" name="name" className="input" required maxLength={80} placeholder="Follow up every new lead" data-testid="auto-name" /></div>
        <div><label className="label" htmlFor="trigger">When</label><select id="trigger" name="trigger" className="input" data-testid="auto-trigger">{TRIGGERS.map((t) => <option key={t} value={t}>{TRIGGER_LABEL[t]}</option>)}</select></div>
        <div><label className="label" htmlFor="c_key">Only if <span className="font-normal text-ink-muted">(optional)</span></label><div className="flex gap-2"><select id="c_key" name="c_key" className="input"><option value="">—</option><option value="source">source</option><option value="stage">stage</option><option value="status">status</option></select><input dir="auto" name="c_value" className="input" placeholder="value, e.g. station" /></div></div>
        <div><label className="label" htmlFor="a_task">Create a task</label><div className="flex gap-2"><input dir="auto" id="a_task" name="a_task" className="input" placeholder="Call within 24 h" maxLength={120} data-testid="auto-task" /><input name="a_task_days" type="number" min={0} max={365} defaultValue={1} className="input w-24" aria-label="Due in days" /></div></div>
        <div><label className="label" htmlFor="a_assign">Assign the lead to</label><select id="a_assign" name="a_assign" className="input"><option value="">—</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        <div><label className="label" htmlFor="a_stage">Move the lead to stage</label><select id="a_stage" name="a_stage" className="input"><option value="">—</option>{stages.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label className="label" htmlFor="a_notify">Notify managers</label><input dir="auto" id="a_notify" name="a_notify" className="input" placeholder="New lead from the booth" maxLength={200} /></div>
        <div className="sm:col-span-2 grid gap-2 sm:grid-cols-[140px_1fr]"><div><label className="label" htmlFor="a_email_to">Email to</label><select id="a_email_to" name="a_email_to" className="input"><option value="lead">the lead (if they consented)</option><option value="registrant">the registrant</option><option value="assignee">the assignee</option></select></div><div><label className="label" htmlFor="a_email_subject">Subject</label><input dir="auto" id="a_email_subject" name="a_email_subject" className="input" maxLength={120} /></div><div className="sm:col-span-2"><label className="label" htmlFor="a_email_text">Message <span className="font-normal text-ink-muted">({'{name}'} = first name)</span></label><textarea dir="auto" id="a_email_text" name="a_email_text" className="input min-h-[70px] py-3" maxLength={2000} /></div></div>
        <div className="sm:col-span-2"><Submit>Create automation</Submit></div>
      </ActionForm>
      <h2 className="h2 mb-3 mt-8">Recent runs</h2>
      {runs.length === 0 ? <p className="card px-4 py-4 text-sm text-ink-muted">No runs yet.</p> : (
        <ul className="card divide-y divide-soft-100 text-sm" data-testid="automation-runs">
          {runs.map((r) => <li key={r.id} className="flex items-center gap-3 px-4 py-2"><span className={`chip ${r.status === 'done' ? 'bg-emerald-50 text-signal-ok' : r.status === 'failed' ? 'bg-red-50 text-signal-stop' : 'chip-muted'}`}>{r.status}</span><span className="min-w-0 flex-1 truncate">{r.name} · {r.trigger}{r.error ? ` · ${r.error}` : ''}</span><span className="text-xs text-ink-muted">{relTime(r.created_at)}</span></li>)}
        </ul>
      )}
    </>
  )
}
