'use server'

import { redirect } from 'next/navigation'
import { signIn, signOut, signUp } from '@/lib/server/services/auth'
import { clearSessionCookie, requestContext, setSessionCookies, SESSION_COOKIE } from '@/lib/server/request'
import { cookies } from 'next/headers'
import { run, str } from './run'
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
