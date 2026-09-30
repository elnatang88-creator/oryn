'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { revokeAllShares, revokeShare, startShare } from '@/lib/server/services/sharing'
import { requireUser } from '@/lib/server/request'
import type { Channel } from '@/lib/capsule-model'
import { bool, run, str } from './run'
import type { ActionState } from './types'

export async function startShareAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const d = str(fd, 'duration')
    const eventId = str(fd, 'eventId')
    const r = await startShare(user.id, {
      capsuleId: str(fd, 'capsuleId') || undefined,
      channel: (str(fd, 'channel') || 'qr') as Channel,
      contextLabel: str(fd, 'context'),
      durationMinutes: d === '' ? undefined : d === 'none' ? null : Number(d),
      oneTime: fd.has('one_time_field') ? bool(fd, 'one_time') : undefined,
      scope: eventId ? 'event' : 'public',
      eventId: eventId || null,
    })
    redirect(`/share/${r.id}`)
  })
}

export async function revokeShareAction(fd: FormData) {
  const user = await requireUser()
  await revokeShare(user.id, str(fd, 'id'))
  revalidatePath('/today')
  const back = str(fd, 'back')
  if (back.startsWith('/') && !back.startsWith('//')) redirect(back)
}

export async function revokeAllAction(_: ActionState) {
  return run(async () => {
    const user = await requireUser()
    const n = await revokeAllShares(user.id)
    revalidatePath('/settings/privacy')
    return n ? `Stopped ${n} share${n === 1 ? '' : 's'}. Those links no longer open.` : 'Nothing was being shared.'
  })
}

export async function shareContextAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const { setShareContext } = await import('@/lib/server/services/sharing')
    await setShareContext(user.id, str(fd, 'id'), str(fd, 'context'))
    revalidatePath(`/share/${str(fd, 'id')}`)
    return 'Saved. Only you see this.'
  })
}
