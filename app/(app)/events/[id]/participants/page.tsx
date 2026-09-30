import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { getEvent, listParticipants } from '@/lib/server/services/events'
import { AppError } from '@/lib/server/errors'
import { addParticipantAction, removeParticipantAction } from '@/app/actions/workspace'
import { ActionForm, Submit } from '@/components/Forms'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Participants' }

export default async function ParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const data = await getEvent(user.id, id).catch((e) => { if (e instanceof AppError) return null; throw e })
  if (!data) notFound()
  const people = await listParticipants(user.id, id)
  return (
    <>
      <Link href={`/events/${id}`} className="btn-quiet mb-2 -ml-2"><ChevronLeft className="h-5 w-5" aria-hidden="true" /> {data.event.name}</Link>
      <PageHeader title="Participants" sub="People with an ORYN account can share at this event right away." />
      <ActionForm action={addParticipantAction} className="card mb-6 grid gap-3 p-4 sm:grid-cols-2" resetOnSuccess>
        <input type="hidden" name="eventId" value={id} />
        <div><label className="label" htmlFor="displayName">Name</label><input dir="auto" id="displayName" name="displayName" className="input" maxLength={80} /></div>
        <div><label className="label" htmlFor="email">Email</label><input dir="auto" id="email" name="email" type="email" className="input" /></div>
        <div><label className="label" htmlFor="role">Role</label><select id="role" name="role" className="input"><option value="attendee">Attendee</option><option value="exhibitor">Exhibitor</option><option value="speaker">Speaker</option><option value="staff">Staff</option></select></div>
        <div className="flex items-end"><Submit className="btn-share w-full">Add participant</Submit></div>
      </ActionForm>
      <ul className="card divide-y divide-soft-100">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{p.display_name}</span><span className="block truncate text-sm text-ink-muted">{p.email} · <span className="capitalize">{p.role}</span> · {p.has_account ? 'Ready' : 'Invited — no account yet'}</span></span>
            <form action={removeParticipantAction}><input type="hidden" name="eventId" value={id} /><input type="hidden" name="id" value={p.id} /><button className="btn-quiet text-sm text-signal-stop">Remove</button></form>
          </li>
        ))}
        {people.length === 0 && <li className="px-4 py-6 text-center text-ink-muted">No participants yet.</li>}
      </ul>
      <p className="mt-3 text-xs text-ink-muted">Removing someone closes their shares at this event. Email invitations need an email provider (not connected yet).</p>
    </>
  )
}
