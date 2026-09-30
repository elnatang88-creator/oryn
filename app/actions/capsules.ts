'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { archiveCapsule, createCapsule, setDefaultCapsule, templateFields, updateCapsule, updatePolicy } from '@/lib/server/services/capsules'
import { requireUser } from '@/lib/server/request'
import { invalid } from '@/lib/server/errors'
import { MODES, type Mode } from '@/lib/capsule-model'
import { bool, run, str } from './run'
import type { ActionState } from './types'

function readCapsule(fd: FormData) {
  let fields: unknown = []
  try {
    fields = JSON.parse(str(fd, 'fields') || '[]')
  } catch {
    throw invalid('Something was off with the fields. Please try again.')
  }
  const primary = str(fd, 'primaryFieldId')
  return {
    name: str(fd, 'name'),
    mode: str(fd, 'mode') as Mode,
    display_name: str(fd, 'display_name'),
    headline: str(fd, 'headline'),
    message: str(fd, 'message'),
    avatar_url: str(fd, 'avatar_url') || null,
    accent: 'blue' as const,
    fields: fields as never,
    primary_action: primary ? { fieldId: primary } : null,
    private_note: str(fd, 'private_note'),
  }
}

export async function createCapsuleAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const id = await createCapsule(user.id, readCapsule(fd))
    redirect(`/capsules/${id}?created=1`)
  })
}

/** Quick start: a capsule from a mode template with the user's name, ready to edit. */
export async function quickCapsuleAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const mode = str(fd, 'mode') as Mode
    if (!MODES.includes(mode)) throw invalid('Choose a mode.')
    const id = await createCapsule(user.id, { name: str(fd, 'label') || mode, mode, display_name: user.display_name, fields: templateFields(mode).map((f) => ({ ...f, value: '' })) })
    redirect(`/capsules/${id}?created=1`)
  })
}

export async function updateCapsuleAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const id = str(fd, 'id')
    await updateCapsule(user.id, id, readCapsule(fd))
    revalidatePath(`/capsules/${id}`)
    return 'Saved. Anyone viewing it now sees this version.'
  })
}

export async function updatePolicyAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const id = str(fd, 'id')
    const d = str(fd, 'duration')
    await updatePolicy(user.id, id, {
      duration_minutes: d === 'none' ? null : Number(d),
      one_time: bool(fd, 'one_time'),
      interaction_level: str(fd, 'interaction_level') as never,
      allow_expanded: bool(fd, 'allow_expanded'),
    })
    revalidatePath(`/capsules/${id}/visibility`)
    return 'Saved. New shares will use these settings.'
  })
}

export async function setDefaultAction(fd: FormData) {
  const user = await requireUser()
  await setDefaultCapsule(user.id, str(fd, 'id'))
  revalidatePath('/capsules')
}

export async function archiveCapsuleAction(fd: FormData) {
  const user = await requireUser()
  await archiveCapsule(user.id, str(fd, 'id'))
  redirect('/capsules')
}
