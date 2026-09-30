'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { requireUser, SESSION_COOKIE, clearSessionCookie } from '@/lib/server/request'
import { cancelDeletion, requestDeletion, requestExport, setRetention } from '@/lib/server/services/privacy'
import { changePassword, revokeOtherSessions, revokeSession, signOut } from '@/lib/server/services/auth'
import { applyPlanChange, billingMode } from '@/lib/server/services/billing'
import { setFlag, setUserPlanAsAdmin, updatePlan } from '@/lib/server/services/admin'
import { updateProfile } from '@/lib/server/services/viewers'
import { invalid } from '@/lib/server/errors'
import { run, str } from './run'
import type { ActionState } from './types'

export async function exportAction(_: ActionState) {
  return run(async () => {
    const user = await requireUser()
    await requestExport(user.id)
    revalidatePath('/settings/privacy')
    return 'We’re preparing your file. It appears below when ready.'
  })
}

export async function deletionAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    await requestDeletion(user.id, str(fd, 'password'))
    revalidatePath('/settings/privacy')
    return 'Scheduled. All your shares stopped now. You can cancel for 7 days.'
  })
}

export async function cancelDeletionAction() {
  const user = await requireUser()
  await cancelDeletion(user.id)
  revalidatePath('/settings/privacy')
}

export async function retentionAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    const v = str(fd, 'days')
    await setRetention(user.id, v === 'plan' ? null : Number(v))
    revalidatePath('/settings/privacy')
    return 'Saved.'
  })
}

export async function revokeSessionAction(fd: FormData) {
  const user = await requireUser()
  const id = str(fd, 'id')
  await revokeSession(user.id, id)
  if (id === user.session_id) {
    await clearSessionCookie()
    redirect('/signin')
  }
  revalidatePath('/settings/security')
}

export async function revokeOthersAction(_: ActionState) {
  return run(async () => {
    const user = await requireUser()
    const n = await revokeOtherSessions(user.id, user.session_id)
    revalidatePath('/settings/security')
    return n ? `Signed out ${n} other session${n === 1 ? '' : 's'}.` : 'No other sessions were signed in.'
  })
}

export async function changePasswordAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    if (str(fd, 'next') !== str(fd, 'confirm')) throw invalid('The new passwords don’t match.')
    await changePassword(user.id, user.session_id, str(fd, 'current'), str(fd, 'next'))
    return 'Password changed. Other sessions were signed out.'
  })
}

export async function changePlanAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    if (billingMode() !== 'simulated') throw invalid('Plan changes go through checkout.')
    await applyPlanChange(user.id, str(fd, 'plan'))
    revalidatePath('/', 'layout')
    redirect(`/settings/plan?changed=${encodeURIComponent(str(fd, 'plan'))}`)
  })
}

export async function adminFlagAction(fd: FormData) {
  const user = await requireUser()
  await setFlag(user.id, str(fd, 'key'), str(fd, 'enabled') === 'true')
  revalidatePath('/admin')
}

export async function adminPlanAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    await updatePlan(user.id, str(fd, 'key'), { priceLabel: str(fd, 'priceLabel') || null, capsules: Number(str(fd, 'capsules')), historyDays: Number(str(fd, 'historyDays')) })
    revalidatePath('/admin')
    return 'Plan saved. No deploy needed.'
  })
}

export async function adminUserPlanAction(fd: FormData) {
  const user = await requireUser()
  await setUserPlanAsAdmin(user.id, str(fd, 'userId'), str(fd, 'plan'))
  revalidatePath('/admin')
}

export async function signOutEverywhereAction() {
  const user = await requireUser()
  await revokeOtherSessions(user.id, user.session_id)
  await signOut((await cookies()).get(SESSION_COOKIE)?.value)
  await clearSessionCookie()
  redirect('/signin')
}

export async function profileAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const user = await requireUser()
    await updateProfile(user.id, {
      display_name: str(fd, 'display_name'),
      profile_headline: str(fd, 'profile_headline'),
      industry: str(fd, 'industry') || null,
      view_visibility: str(fd, 'view_visibility') === 'private' ? 'private' : 'visible',
    })
    revalidatePath('/', 'layout')
    return 'Saved.'
  })
}
