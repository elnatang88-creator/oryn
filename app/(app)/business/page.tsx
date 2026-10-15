import Link from 'next/link'
import { ArrowRight, CheckSquare, Download, Plus, Workflow } from 'lucide-react'
import { listLeads, pipelineSummary } from '@/lib/server/services/crm'
import { createLeadAction, leadStageFormAction, pipelineStagesAction } from '@/app/actions/workspace'
import { ActionForm, Submit } from '@/components/Forms'
import { PageHeader, relTime } from '@/components/ui'
import { businessContext, OrgSwitch } from './_org'

export const metadata = { title: 'Business' }

/** The workspace pipeline: every lead from stations, booths, forms and registrations, by stage. */
export default async function BusinessPage({ searchParams }: { searchParams: Promise<{ org?: string; stage?: string; q?: string }> }) {
  const sp = await searchParams
  const { user, orgs, org } = await businessContext(sp.org)
  const [summary, leads] = await Promise.all([pipelineSummary(user.id, org.id), listLeads(user.id, org.id, { stage: sp.stage, q: sp.q })])
  const canManage = ['owner', 'admin'].includes(org.role)
  return (
    <>
      <PageHeader title={org.name} sub="Leads from your stations, booths, forms and events — and what happens next." action={<Link href="#new-lead" className="btn-more"><Plus className="h-5 w-5" aria-hidden="true" /> Lead</Link>} />
      <OrgSwitch orgs={orgs} org={org} base="/business" />
      <div className="mb-5 grid grid-cols-3 gap-2">
        <Link href={`/business/tasks?org=${org.id}`} className="card flex min-h-[64px] flex-col items-center justify-center px-2 text-center hover:border-electric-400"><span className="text-xl font-bold text-navy-900">{summary.tasks.mine}</span><span className="text-[11px] font-semibold text-ink-muted"><CheckSquare className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />My tasks{summary.tasks.overdue ? ` · ${summary.tasks.overdue} overdue` : ''}</span></Link>
        <Link href={`/business/automations?org=${org.id}`} className="card flex min-h-[64px] flex-col items-center justify-center px-2 text-center hover:border-electric-400"><Workflow className="h-5 w-5 text-electric" aria-hidden="true" /><span className="text-[11px] font-semibold text-ink-muted">Automations</span></Link>
        <a href={`/api/v1/orgs/${org.id}/leads.csv`} className="card flex min-h-[64px] flex-col items-center justify-center px-2 text-center hover:border-electric-400"><Download className="h-5 w-5 text-electric" aria-hidden="true" /><span className="text-[11px] font-semibold text-ink-muted">Export CSV</span></a>
      </div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Stage" data-testid="pipeline">
        <Link href={`/business?org=${org.id}`} role="tab" aria-selected={!sp.stage} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold ${!sp.stage ? 'bg-navy-900 text-white' : 'border border-soft-300 bg-white'}`}>All · {summary.stages.reduce((a, s) => a + s.n, 0)}</Link>
        {summary.stages.map((s) => <Link key={s.stage} href={`/business?org=${org.id}&stage=${encodeURIComponent(s.stage)}`} role="tab" aria-selected={sp.stage === s.stage} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold ${sp.stage === s.stage ? 'bg-navy-900 text-white' : 'border border-soft-300 bg-white'}`}>{s.stage} · {s.n}</Link>)}
      </div>
      <form className="mb-4"><input type="hidden" name="org" value={org.id} />{sp.stage && <input type="hidden" name="stage" value={sp.stage} />}<input dir="auto" name="q" defaultValue={sp.q ?? ''} className="input mt-0" placeholder="Search leads by name, company, email or tag" aria-label="Search leads" /></form>
      {leads.length === 0 ? (
        <p className="card px-4 py-5 text-ink-muted" data-testid="leads-empty">{sp.q || sp.stage ? 'No leads match.' : 'No leads yet. Put a station in “Lead capture” mode at your booth, or add one by hand below.'}</p>
      ) : (
        <ul className="space-y-2" data-testid="leads">
          {leads.map((l) => (
            <li key={l.id} className="card flex items-center gap-3 px-4 py-3">
              <Link href={`/business/leads/${l.id}`} className="min-w-0 flex-1">
                <span dir="auto" className="block truncate font-semibold">{l.name}{l.company ? <span className="font-normal text-ink-muted"> · {l.company}</span> : null}</span>
                <span className="block truncate text-xs text-ink-muted">{[l.source === 'station' ? `Station${l.station_name ? ` ${l.station_name}` : ''}` : l.source, l.event_name, l.assignee_name ? `→ ${l.assignee_name}` : 'unassigned', relTime(l.updated_at)].filter(Boolean).join(' · ')}{l.open_tasks ? ` · ${l.open_tasks} open task${l.open_tasks === 1 ? '' : 's'}` : ''}</span>
              </Link>
              <form action={leadStageFormAction}><input type="hidden" name="id" value={l.id} />
                <label className="sr-only" htmlFor={`st-${l.id}`}>Stage</label>
                <select id={`st-${l.id}`} name="stage" defaultValue={l.stage} className="input mt-0 min-h-[40px] w-auto text-sm" data-testid="lead-stage">{summary.stages.map((s) => <option key={s.stage} value={s.stage}>{s.stage}</option>)}</select>
                <button className="btn-quiet text-sm" aria-label="Move">Move</button></form>
              <Link href={`/business/leads/${l.id}`} aria-label="Open lead"><ArrowRight className="h-5 w-5 text-ink-faint" /></Link>
            </li>
          ))}
        </ul>
      )}
      <h2 id="new-lead" className="h2 mb-3 mt-10 scroll-mt-20">Add a lead by hand</h2>
      <ActionForm action={createLeadAction} className="card grid gap-3 p-4 sm:grid-cols-2">
        <input type="hidden" name="orgId" value={org.id} />
        <div><label className="label" htmlFor="name">Name</label><input dir="auto" id="name" name="name" className="input" required maxLength={80} /></div>
        <div><label className="label" htmlFor="company">Company</label><input dir="auto" id="company" name="company" className="input" maxLength={80} /></div>
        <div><label className="label" htmlFor="email">Email</label><input dir="auto" id="email" name="email" type="email" className="input" /></div>
        <div><label className="label" htmlFor="phone">Phone</label><input dir="auto" id="phone" name="phone" type="tel" className="input" maxLength={40} /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="message">Context</label><input dir="auto" id="message" name="message" className="input" maxLength={2000} placeholder="Where you met, what they want" /></div>
        <div className="sm:col-span-2"><Submit>Add lead</Submit></div>
      </ActionForm>
      {canManage && (
        <ActionForm action={pipelineStagesAction} className="card mt-6 p-4">
          <input type="hidden" name="orgId" value={org.id} />
          <label className="label" htmlFor="stages">Pipeline stages <span className="font-normal text-ink-muted">(one per line, in order)</span></label>
          <textarea id="stages" name="stages" defaultValue={summary.stages.map((s) => s.stage).join('\n')} className="input min-h-[120px] py-3" />
          <div className="mt-2"><Submit className="btn-more">Save stages</Submit></div>
        </ActionForm>
      )}
    </>
  )
}
