import Link from 'next/link'
import { requireUser } from '@/lib/server/request'
import { getOrg, listMyOrgs, orgAudit } from '@/lib/server/services/orgs'
import { getDb } from '@/lib/server/db'
import { has, userPlan } from '@/lib/server/plans'
import { addMemberAction, changeRoleAction, createOrgAction, createTeamAction, removeMemberAction } from '@/app/actions/workspace'
import { ActionForm, Submit } from '@/components/Forms'
import { PageHeader, PlanGate, relTime } from '@/components/ui'

export const metadata = { title: 'Teams' }

export default async function TeamsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const sp = await searchParams
  const user = await requireUser()
  const orgs = await listMyOrgs(user.id)
  const plan = await userPlan(await getDb(), user.id)
  const current = orgs.find((o) => o.id === sp.org) ?? orgs[0]
  const org = current ? await getOrg(user.id, current.id) : null
  const log = org && org.permissions.includes('audit.view') ? await orgAudit(user.id, org.org.id) : []
  const canManage = org?.permissions.includes('members.manage')

  return (
    <>
      <PageHeader title="Teams" sub="Your company owns the workspace, its brand, its events and its data." />
      {orgs.length > 1 && (
        <div className="mb-5 flex gap-2 overflow-x-auto">{orgs.map((o) => <Link key={o.id} href={`/teams?org=${o.id}`} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${o.id === current?.id ? 'border-electric bg-electric text-white' : 'border-soft-300 bg-white'}`}>{o.name}</Link>)}</div>
      )}
      {org && (
        <>
          <section className="card mb-6 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 className="h2">{org.org.name}</h2><p className="text-sm text-ink-muted">You are <span className="font-semibold capitalize">{org.role}</span> · {org.members.length} members · <span className="capitalize">{org.org.plan_key}</span></p></div>
              <div className="flex gap-2"><Link href={`/stations?org=${org.org.id}`} className="btn-more text-sm">Stations</Link><Link href="/events" className="btn-more text-sm">Events</Link></div>
            </div>
            <ul className="mt-4 divide-y divide-soft-100">
              {org.members.map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-0 flex-1"><span className="block font-semibold">{m.display_name}</span><span className="block text-sm text-ink-muted">{m.email}{m.team_name ? ` · ${m.team_name}` : ''}</span></span>
                  {canManage && m.role !== 'owner' && m.user_id !== user.id ? (
                    <div className="flex items-center gap-1">
                      <form action={changeRoleAction} className="flex items-center gap-1">
                        <input type="hidden" name="orgId" value={org.org.id} /><input type="hidden" name="userId" value={m.user_id} />
                        <label className="sr-only" htmlFor={`role-${m.user_id}`}>Role</label>
                        <select id={`role-${m.user_id}`} name="role" defaultValue={m.role} className="input mt-0 min-h-[40px] w-auto py-0 text-sm">{['admin', 'manager', 'member'].map((r) => <option key={r} value={r}>{r}</option>)}</select>
                        <button className="btn-quiet text-sm">Save</button>
                      </form>
                      <form action={removeMemberAction}><input type="hidden" name="orgId" value={org.org.id} /><input type="hidden" name="userId" value={m.user_id} /><button className="btn-quiet text-sm text-signal-stop">Remove</button></form>
                    </div>
                  ) : <span className="chip-muted capitalize">{m.role}</span>}
                </li>
              ))}
            </ul>
          </section>
          {canManage && (
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <ActionForm action={addMemberAction} className="card space-y-3 p-4" resetOnSuccess>
                <h3 className="font-bold text-navy-900">Add a member</h3>
                <input type="hidden" name="orgId" value={org.org.id} />
                <div><label className="label" htmlFor="memail">Email</label><input dir="auto" id="memail" name="email" type="email" className="input" /></div>
                <div><label className="label" htmlFor="mrole">Role</label><select id="mrole" name="role" className="input"><option value="member">Member — shares with the team brand</option><option value="manager">Manager — runs events and stations</option>{org.role === 'owner' && <option value="admin">Admin — manages people</option>}</select></div>
                <Submit className="btn-more w-full">Add</Submit>
              </ActionForm>
              <ActionForm action={createTeamAction} className="card space-y-3 p-4" resetOnSuccess>
                <h3 className="font-bold text-navy-900">Teams</h3>
                <p className="text-sm text-ink-muted">{org.teams.map((t) => t.name).join(', ') || 'No teams yet.'}</p>
                <input type="hidden" name="orgId" value={org.org.id} />
                <div><label className="label" htmlFor="tname">New team</label><input dir="auto" id="tname" name="name" className="input" placeholder="Sales" /></div>
                <Submit className="btn-more w-full">Create team</Submit>
              </ActionForm>
            </div>
          )}
          {log.length > 0 && (
            <section className="mb-8">
              <h2 className="h2 mb-3">Audit log</h2>
              <ul className="card max-h-80 divide-y divide-soft-100 overflow-y-auto text-sm">
                {log.map((a) => <li key={a.id} className="flex justify-between gap-3 px-4 py-2.5"><span><span className="font-medium">{a.actor ?? 'System'}</span> · <code className="text-ink-muted">{a.action}</code></span><span className="shrink-0 text-ink-muted">{relTime(a.created_at)}</span></li>)}
              </ul>
            </section>
          )}
        </>
      )}
      <h2 className="h2 mb-3">{orgs.length ? 'Another workspace' : 'Create a workspace'}</h2>
      {has(plan, 'org.workspace') ? (
        <ActionForm action={createOrgAction} className="card flex gap-2 p-4">
          <label htmlFor="oname" className="sr-only">Workspace name</label>
          <input dir="auto" id="oname" name="name" className="input mt-0 flex-1" placeholder="Company or event team" />
          <Submit className="btn-share">Create</Submit>
        </ActionForm>
      ) : <PlanGate message="Team workspaces — shared brand, roles, events and stations — are part of Business." />}
    </>
  )
}
