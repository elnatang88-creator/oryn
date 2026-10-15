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

// ─── Event public page, registration settings, stations v2, CRM, automations ─────────────────────

export async function eventDetailsAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const id = str(fd, 'id')
    const fields = str(fd, 'registrationFields').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      // "Label | text|select|checkbox | required | option1;option2"
      const [label, kind = 'text', req = '', opts = ''] = l.split('|').map((x) => x.trim())
      const idv = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'q'
      return { id: idv, label, kind: (['text', 'select', 'checkbox'].includes(kind) ? kind : 'text') as 'text' | 'select' | 'checkbox', required: /^(y|yes|req|required|\*)$/i.test(req), options: kind === 'select' ? opts.split(';').map((o) => o.trim()).filter(Boolean) : undefined }
    })
    const types = str(fd, 'ticketTypes').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [name, price = '', qty = ''] = l.split('|').map((x) => x.trim())
      return { id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 't', name, price_label: price || null, quantity: qty ? Number(qty) : null }
    })
    const { updateEventDetails } = await import('@/lib/server/services/registrations')
    const slug = await updateEventDetails(user.id, id, {
      slug: str(fd, 'slug'), description: str(fd, 'description'), timezone: str(fd, 'timezone') || 'UTC',
      startsAt: str(fd, 'startsAt') || null, endsAt: str(fd, 'endsAt') || null, capacity: str(fd, 'capacity') ? Number(str(fd, 'capacity')) : null,
      published: bool(fd, 'published'), registrationOpen: bool(fd, 'registrationOpen'), waitlist: bool(fd, 'waitlist'), registrationFields: fields, ticketTypes: types,
    })
    revalidatePath(`/events/${id}`)
    return `Saved. Public page: /e/${slug}`
  })
}

export async function configureStationAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const { configureStation } = await import('@/lib/server/services/stations')
    await configureStation(user.id, str(fd, 'id'), { mode: str(fd, 'mode') as never, destinationUrl: str(fd, 'destinationUrl') || null, eventId: str(fd, 'eventId') || null, capsuleId: str(fd, 'capsuleId') || null, headline: str(fd, 'headline'), prompt: str(fd, 'prompt') })
    revalidatePath('/stations')
    return 'Station updated. The printed code now does this.'
  })
}

export async function startTransferAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const { startStationTransfer } = await import('@/lib/server/services/stations')
    const code = await startStationTransfer(user.id, str(fd, 'id'))
    return `Transfer code (give it to the receiving workspace, valid until used): ${code}`
  })
}

export async function acceptTransferAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const { acceptStationTransfer } = await import('@/lib/server/services/stations')
    await acceptStationTransfer(user.id, str(fd, 'orgId'), str(fd, 'code'))
    revalidatePath('/stations')
    return 'Station transferred to this workspace.'
  })
}

export async function createLeadAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const { createLead } = await import('@/lib/server/services/crm')
    const id = await createLead(str(fd, 'orgId'), { name: str(fd, 'name'), email: str(fd, 'email'), phone: str(fd, 'phone'), company: str(fd, 'company'), message: str(fd, 'message'), source: 'manual', eventId: str(fd, 'eventId') || null }, { userId: user.id })
    redirect(`/business/leads/${id}`)
  })
}

export async function updateLeadAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const { updateLead } = await import('@/lib/server/services/crm')
    const id = str(fd, 'id')
    await updateLead(user.id, id, {
      stage: fd.has('stage') ? str(fd, 'stage') : undefined,
      assigneeUserId: fd.has('assignee') ? (str(fd, 'assignee') || null) : undefined,
      tags: fd.has('tags') ? str(fd, 'tags').split(',') : undefined,
    })
    revalidatePath(`/business/leads/${id}`); revalidatePath('/business')
    return 'Saved.'
  })
}

export async function leadStageFormAction(fd: FormData) {
  const user = await requireUser()
  const { updateLead } = await import('@/lib/server/services/crm')
  const id = str(fd, 'id')
  await updateLead(user.id, id, { stage: str(fd, 'stage') })
  revalidatePath('/business'); revalidatePath(`/business/leads/${id}`)
}

export async function addLeadNoteAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const { addLeadNote } = await import('@/lib/server/services/crm')
    const id = str(fd, 'id')
    await addLeadNote(user.id, id, str(fd, 'body'))
    revalidatePath(`/business/leads/${id}`)
    return 'Note added.'
  })
}

export async function createTaskAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const { createTask } = await import('@/lib/server/services/crm')
    await createTask(user.id, str(fd, 'orgId'), { title: str(fd, 'title'), dueOn: str(fd, 'dueOn') || null, leadId: str(fd, 'leadId') || null, assigneeUserId: str(fd, 'assignee') || null })
    revalidatePath('/business/tasks'); if (str(fd, 'leadId')) revalidatePath(`/business/leads/${str(fd, 'leadId')}`)
    return 'Task added.'
  })
}

export async function toggleTaskAction(fd: FormData) {
  const user = await requireUser()
  const { setTaskDone } = await import('@/lib/server/services/crm')
  await setTaskDone(user.id, str(fd, 'id'), str(fd, 'done') === 'true')
  revalidatePath('/business/tasks'); if (str(fd, 'leadId')) revalidatePath(`/business/leads/${str(fd, 'leadId')}`)
}

export async function pipelineStagesAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const { setPipelineStages } = await import('@/lib/server/services/crm')
    await setPipelineStages(user.id, str(fd, 'orgId'), str(fd, 'stages').split('\n'))
    revalidatePath('/business')
    return 'Pipeline saved.'
  })
}

export async function createAutomationAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const { createAutomation } = await import('@/lib/server/services/automations')
    const actions: Record<string, unknown>[] = []
    if (str(fd, 'a_task')) actions.push({ type: 'create_task', title: str(fd, 'a_task'), dueInDays: Number(str(fd, 'a_task_days') || 1), assignee: 'assignee' })
    if (str(fd, 'a_assign')) actions.push({ type: 'assign_lead', userId: str(fd, 'a_assign') })
    if (str(fd, 'a_stage')) actions.push({ type: 'update_stage', stage: str(fd, 'a_stage') })
    if (str(fd, 'a_notify')) actions.push({ type: 'notify', to: 'managers', body: str(fd, 'a_notify') })
    if (str(fd, 'a_email_subject') && str(fd, 'a_email_text')) actions.push({ type: 'send_email', to: str(fd, 'a_email_to') || 'lead', subject: str(fd, 'a_email_subject'), text: str(fd, 'a_email_text') })
    const conditions: Record<string, string> = {}
    if (str(fd, 'c_key') && str(fd, 'c_value')) conditions[str(fd, 'c_key')] = str(fd, 'c_value')
    await createAutomation(user.id, str(fd, 'orgId'), { name: str(fd, 'name'), trigger: str(fd, 'trigger') as never, conditions, actions: actions as never, enabled: true })
    revalidatePath('/business/automations')
    return 'Automation created. It runs on the next matching event.'
  })
}

export async function automationToggleAction(fd: FormData) {
  const user = await requireUser()
  const { setAutomationEnabled, deleteAutomation } = await import('@/lib/server/services/automations')
  if (str(fd, 'delete') === '1') await deleteAutomation(user.id, str(fd, 'id'))
  else await setAutomationEnabled(user.id, str(fd, 'id'), str(fd, 'enabled') === 'true')
  revalidatePath('/business/automations')
}
