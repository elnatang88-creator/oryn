import 'server-only'
import crypto from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { userForSessionToken, SESSION_DAYS } from './services/auth'
import { hmac } from './secrets'

export const SESSION_COOKIE = 'oryn_session'
export const DEVICE_COOKIE = 'oryn_device'
export const CLAIM_COOKIE = 'oryn_claim'

const secure = () => process.env.NODE_ENV === 'production' && process.env.ORYN_INSECURE_COOKIES !== 'true'

export async function currentUser() {
  const jar = await cookies()
  return userForSessionToken(jar.get(SESSION_COOKIE)?.value)
}

/** Server-side gate for every workspace page and action. */
export async function requireUser() {
  const user = await currentUser()
  if (!user) redirect('/signin')
  return user
}

export async function setSessionCookies(token: string, deviceId: string) {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: secure(), sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 86400 })
  jar.set(DEVICE_COOKIE, deviceId, { httpOnly: true, secure: secure(), sameSite: 'lax', path: '/', maxAge: 400 * 86400 })
}

export async function clearSessionCookie() {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}

export async function requestContext() {
  const h = await headers()
  const jar = await cookies()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local'
  return {
    userAgent: (h.get('user-agent') ?? '').slice(0, 300),
    deviceId: jar.get(DEVICE_COOKIE)?.value ?? null,
    // Raw IP addresses are never stored; a keyed hash is used only as a rate-limit bucket.
    ipKey: hmac(`ip:${ip}`).slice(0, 24),
  }
}

/** Recipient browser's random claim token (only used to bind one-time capsules to the first opener). */
export async function readClaim(): Promise<string | null> {
  return (await cookies()).get(CLAIM_COOKIE)?.value ?? null
}

export function newClaimToken() {
  return crypto.randomBytes(18).toString('base64url')
}

export async function writeClaim(token: string) {
  ;(await cookies()).set(CLAIM_COOKIE, token, { httpOnly: true, secure: secure(), sameSite: 'lax', path: '/', maxAge: 30 * 86400 })
}

/** Absolute origin for links and QR codes. Prefer the configured public URL (company-owned domain). */
export async function appOrigin() {
  const configured = (process.env.ORYN_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL)?.replace(/\/$/, '')
  if (configured) return configured
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
  return `${proto}://${host}`
}
