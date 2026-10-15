'use server'

import { redirect } from 'next/navigation'
import { reportShare, requestConnection, resolveShare } from '@/lib/server/services/sharing'
import { keepCapsule } from '@/lib/server/services/connections'
import { currentUser, readClaim, requestContext } from '@/lib/server/request'
import { verifyShareToken } from '@/lib/server/tokens'
import { run, str } from './run'
import type { ActionState } from './types'

function tokenFrom(fd: FormData) {
  const t = str(fd, 'token')
  if (!verifyShareToken(t).ok) redirect('/c/unavailable')
  return t
}

/** One-time capsules open only on a deliberate tap, so link previews can't use up the single view. */
export async function openOnceAction(fd: FormData) {
  const token = tokenFrom(fd)
  await resolveShare(token, { record: true, claimToken: await readClaim() })
  redirect(`/c/${token}`)
}

export async function requestConnectAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const token = tokenFrom(fd)
    const ctx = await requestContext()
    const me = await currentUser()
    await requestConnection(token, { name: str(fd, 'name'), contact: str(fd, 'contact'), message: str(fd, 'message') }, { claimToken: await readClaim(), ipKey: ctx.ipKey, recipientUserId: me?.id ?? null })
    redirect(`/c/${token}/connect?sent=1`)
  })
}

export async function keepAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const token = tokenFrom(fd)
    const me = await currentUser()
    if (!me) redirect(`/signup?next=${encodeURIComponent(`/c/${token}/keep`)}`)
    const id = await keepCapsule(me.id, token, await readClaim())
    redirect(`/connections/${id}?kept=1`)
  })
}

export async function reportAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const token = tokenFrom(fd)
    await reportShare(token, str(fd, 'reason'), await requestContext())
    return 'Thank you. We’ll review it. The sender is not told.'
  })
}
