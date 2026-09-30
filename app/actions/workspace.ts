'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/server/request'
import { addMember, changeRole, createOrg, createTeam, removeMember } from '@/lib/server/services/orgs'
import { addParticipant, createEvent, removeParticipant, setEventStatus, updateEventRules } from '@/lib/server/services/events'
import { createStation, reassignStation, setStationActive } from '@/lib/server/services/stations'
import type { Role } from '@/lib/server/permissions'
import { bool, run, str } from './run'
import type { ActionState } from './types'

export async function createOrgAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const id = await createOrg(user.id, str(fd, 'name'))
    redirect(`/teams?org=${id}`)
  })
}

export async function addMemberAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    await addMember(user.id, str(fd, 'orgId'), { email: str(fd, 'email'), role: str(fd, 'role') as never })
    revalidatePath('/teams')
    return 'Added.'
  })
}

export async function changeRoleAction(fd: FormData) {
  const user = await requireUser()
  await changeRole(user.id, str(fd, 'orgId'), str(fd, 'userId'), str(fd, 'role') as Role)
  revalidatePath('/teams')
}

export async function removeMemberAction(fd: FormData) {
  const user = await requireUser()
  await removeMember(user.id, str(fd, 'orgId'), str(fd, 'userId'))
  revalidatePath('/teams')
}

export async function createTeamAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    await createTeam(user.id, str(fd, 'orgId'), str(fd, 'name'))
    revalidatePath('/teams')
    return 'Team created.'
  })
}

export async function createEventAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const id = await createEvent(user.id, str(fd, 'orgId'), {
      name: str(fd, 'name'), venue: str(fd, 'venue'), startsOn: str(fd, 'startsOn') || null, endsOn: str(fd, 'endsOn') || null,
      allowPhone: bool(fd, 'allowPhone'), note: str(fd, 'note'),
    })
    redirect(`/events/${id}`)
  })
}

export async function eventStatusAction(fd: FormData) {
  const user = await requireUser()
  const id = str(fd, 'id')
  await setEventStatus(user.id, id, str(fd, 'status') as never)
  revalidatePath(`/events/${id}`)
}

export async function eventRulesAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const id = str(fd, 'id')
    await updateEventRules(user.id, id, { allowPhone: bool(fd, 'allowPhone'), note: str(fd, 'note') })
    revalidatePath(`/events/${id}`)
    return 'Rules saved. They apply to every share at this event right away.'
  })
}

export async function addParticipantAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const id = str(fd, 'eventId')
    await addParticipant(user.id, id, { email: str(fd, 'email'), displayName: str(fd, 'displayName'), role: str(fd, 'role') as never })
    revalidatePath(`/events/${id}/participants`)
    return 'Added.'
  })
}

export async function removeParticipantAction(fd: FormData) {
  const user = await requireUser()
  const id = str(fd, 'eventId')
  await removeParticipant(user.id, id, str(fd, 'id'))
  revalidatePath(`/events/${id}/participants`)
}

export async function createStationAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const orgId = str(fd, 'orgId')
    await createStation(user.id, orgId, { name: str(fd, 'name'), kind: str(fd, 'kind') as never, capsuleId: str(fd, 'capsuleId'), eventId: str(fd, 'eventId') || null })
    redirect(`/stations?org=${orgId}`)
  })
}

export async function reassignStationAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    await reassignStation(user.id, str(fd, 'id'), str(fd, 'capsuleId'))
    revalidatePath('/stations')
    return 'Updated. The printed code now opens this capsule.'
  })
}

export async function stationActiveAction(fd: FormData) {
  const user = await requireUser()
  await setStationActive(user.id, str(fd, 'id'), str(fd, 'active') === 'true')
  revalidatePath('/stations')
}
