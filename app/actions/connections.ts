'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { addFollowUp, addNote, archiveConnection, deleteNote, respondToRequest, setFollowUpDone, updateConnectionContext } from '@/lib/server/services/connections'
import { markNotificationsRead } from '@/lib/server/services/today'
import { requireUser } from '@/lib/server/request'
import { run, str } from './run'
import type { ActionState } from './types'

export async function respondAction(fd: FormData) {
  const user = await requireUser()
  const decision = str(fd, 'decision')
  if (decision !== 'accept' && decision !== 'decline') return // never guess a decision
  const accept = decision === 'accept'
  const { connectionId } = await respondToRequest(user.id, str(fd, 'id'), accept)
  revalidatePath('/today')
  revalidatePath('/connections/requests')
  if (connectionId) redirect(`/connections/${connectionId}?new=1`)
}

export async function addNoteAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const id = str(fd, 'connectionId')
    await addNote(user.id, id, str(fd, 'body'))
    revalidatePath(`/connections/${id}`)
    return 'Note saved. Only you can see it.'
  })
}

export async function deleteNoteAction(fd: FormData) {
  const user = await requireUser()
  await deleteNote(user.id, str(fd, 'id'))
  revalidatePath(`/connections/${str(fd, 'connectionId')}`)
}

export async function addFollowUpAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const id = str(fd, 'connectionId')
    await addFollowUp(user.id, id, { title: str(fd, 'title'), dueOn: str(fd, 'dueOn') })
    revalidatePath(`/connections/${id}`)
    return 'Follow-up set.'
  })
}

export async function toggleFollowUpAction(fd: FormData) {
  const user = await requireUser()
  await setFollowUpDone(user.id, str(fd, 'id'), str(fd, 'done') === 'true')
  revalidatePath('/follow-ups')
  revalidatePath('/today')
  const back = str(fd, 'back')
  if (back) revalidatePath(back)
}

export async function archiveConnectionAction(fd: FormData) {
  const user = await requireUser()
  await archiveConnection(user.id, str(fd, 'id'))
  redirect('/connections')
}

export async function updateContextAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const id = str(fd, 'connectionId')
    await updateConnectionContext(user.id, id, str(fd, 'metWhere'))
    revalidatePath(`/connections/${id}`)
    return 'Saved.'
  })
}

export async function markReadAction() {
  const user = await requireUser()
  await markNotificationsRead(user.id)
  revalidatePath('/today')
}
