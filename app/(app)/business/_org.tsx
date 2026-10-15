import 'server-only'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/request'
import { listMyOrgs } from '@/lib/server/services/orgs'

/** Which workspace the Business area is showing: ?org= or the first one. No workspace → go create one. */
export async function businessContext(orgParam?: string) {
  const user = await requireUser()
  const orgs = await listMyOrgs(user.id)
  if (!orgs.length) redirect('/teams?business=1')
  const org = orgs.find((o) => o.id === orgParam) ?? orgs[0]
  return { user, orgs, org }
}

export function OrgSwitch({ orgs, org, base }: { orgs: { id: string; name: string }[]; org: { id: string }; base: string }) {
  if (orgs.length < 2) return null
  return (
    <form className="mb-4"><label htmlFor="org" className="sr-only">Workspace</label>
      <select id="org" name="org" defaultValue={org.id} className="input mt-0 min-h-[40px] w-auto text-sm" data-base={base}>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
      <button className="btn-quiet ml-2 text-sm">Switch</button></form>
  )
}
