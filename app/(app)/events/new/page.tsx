import Link from 'next/link'
import { requireUser } from '@/lib/server/request'
import { listMyOrgs } from '@/lib/server/services/orgs'
import { createEventAction } from '@/app/actions/workspace'
import { ActionForm, Submit } from '@/components/Forms'
import { Empty, PageHeader } from '@/components/ui'

export const metadata = { title: 'New event' }

export default async function NewEventPage() {
  const user = await requireUser()
  const orgs = (await listMyOrgs(user.id)).filter((o) => ['owner', 'admin', 'manager'].includes(o.role))
  if (!orgs.length) return (<><PageHeader title="New event" /><Empty title="You need a team workspace" body="Events belong to a workspace so the team owns the event, its stations and its rules." action={<Link href="/teams" className="btn-share">Create a workspace</Link>} /></>)
  return (
    <>
      <PageHeader title="New event" sub="You can change everything until it goes live." />
      <ActionForm action={createEventAction} className="card space-y-5 p-5">
        {orgs.length > 1 ? (
          <div><label className="label" htmlFor="orgId">Workspace</label><select id="orgId" name="orgId" className="input">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
        ) : <input type="hidden" name="orgId" value={orgs[0].id} />}
        <div><label className="label" htmlFor="name">Event name</label><input dir="auto" id="name" name="name" className="input" maxLength={80} required /></div>
        <div><label className="label" htmlFor="venue">Venue</label><input dir="auto" id="venue" name="venue" className="input" maxLength={120} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="startsOn">Starts</label><input dir="auto" id="startsOn" name="startsOn" type="date" className="input" /></div>
          <div><label className="label" htmlFor="endsOn">Ends</label><input dir="auto" id="endsOn" name="endsOn" type="date" className="input" /></div>
        </div>
        <fieldset className="rounded-2xl bg-soft-50 p-4">
          <legend className="px-1 text-sm font-bold text-navy-900">Sharing rules for everyone at this event</legend>
          <label className="mt-2 flex min-h-[48px] items-center gap-3"><input type="checkbox" name="allowPhone" className="h-5 w-5 accent-electric" /> Allow phone numbers</label>
          <p className="hint">Off by default. Participants’ phone numbers stay hidden in event shares even if their capsule includes one.</p>
          <label className="label mt-4" htmlFor="note">A note for participants</label>
          <input dir="auto" id="note" name="note" className="input" maxLength={200} placeholder="Please share work details only." />
        </fieldset>
        <Submit>Create event</Submit>
      </ActionForm>
    </>
  )
}
