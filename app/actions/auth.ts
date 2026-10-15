'use server'

import { redirect } from 'next/navigation'
import {signIn, signOut, signUp, requestPasswordReset, resetPasswordWithToken, sendVerificationEmail } from '@/lib/server/services/auth'
import {clearSessionCookie, requestContext, setSessionCookies, SESSION_COOKIE, requireUser } from '@/lib/server/request'
import { cookies } from 'next/headers'
import { run, str } from './run'
import { invalid } from '@/lib/server/errors'
import type { ActionState } from './types'

function safeNext(next: string) {
  return next.startsWith('/') && !next.startsWith('//') ? next : null
}

export async function signUpAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const r = await signUp({ email: str(fd, 'email'), password: str(fd, 'password'), displayName: str(fd, 'name') }, await requestContext())
    await setSessionCookies(r.token, r.deviceId)
    redirect(safeNext(str(fd, 'next')) ?? '/capsules/new?first=1')
  })
}

export async function signInAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const r = await signIn({ email: str(fd, 'email'), password: str(fd, 'password') }, await requestContext())
    await setSessionCookies(r.token, r.deviceId)
    redirect(safeNext(str(fd, 'next')) ?? '/today')
  })
}

export async function signOutAction() {
  const jar = await cookies()
  await signOut(jar.get(SESSION_COOKIE)?.value)
  await clearSessionCookie()
  redirect('/')
}

export async function forgotPasswordAction(_: ActionState, fd: FormData) {
  return run(async () => {
    await requestPasswordReset(str(fd, 'email'), await requestContext())
    return 'If that email has an ORYN account, a reset link is on its way.'
  })
}

export async function resetPasswordAction(_: ActionState, fd: FormData) {
  return run(async () => {
    if (str(fd, 'password') !== str(fd, 'confirm')) throw invalid('The passwords don’t match.')
    await resetPasswordWithToken(str(fd, 'token'), str(fd, 'password'))
    redirect('/signin?reset=1')
  })
}

export async function resendVerificationAction(_: ActionState) {
  return run(async () => {
    const user = await requireUser()
    await sendVerificationEmail(user.id)
    return 'Sent. Check your inbox.'
  })
}
