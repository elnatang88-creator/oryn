import 'server-only'
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { z } from 'zod'
import { getDb, type Db } from '../db'
import { newId } from '../ids'
import { sha256, safeEqual } from '../secrets'
import { AppError, invalid } from '../errors'
import { audit } from '../audit'
import { track } from '../analytics'
import { isLimited, rateLimit } from '../ratelimit'

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
export const SESSION_DAYS = 30

export interface User {
  id: string
  email: string
  display_name: string
  plan_key: string
  is_platform_admin: boolean
  retention_days: number | null
  created_at: Date
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(pw, salt, 64, SCRYPT)
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${key.toString('base64url')}`
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, key] = stored.split('$')
  if (alg !== 'scrypt') return false
  const derived = await scrypt(pw, Buffer.from(salt, 'base64url'), 64, { N: +n, r: +r, p: +p, maxmem: SCRYPT.maxmem })
  return safeEqual(derived.toString('base64url'), key)
}

const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email.').max(254),
  password: z.string().min(10, 'Use at least 10 characters.').max(200),
  displayName: z.string().trim().min(1, 'Add your name.').max(80),
})

export function describeDevice(ua: string): string {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'device'
  return `${browser} on ${os}`
}

async function createSession(db: Db, userId: string, deviceId: string | null, userAgent: string) {
  let device = deviceId
  if (device) {
    const r = await db.query(`UPDATE devices SET last_seen_at = now() WHERE id = $1 AND user_id = $2 RETURNING id`, [device, userId])
    if (!r.length) device = null
  }
  if (!device) {
    device = newId('dev')
    await db.query(`INSERT INTO devices (id, user_id, label) VALUES ($1,$2,$3)`, [device, userId, describeDevice(userAgent)])
  }
  const token = crypto.randomBytes(32).toString('base64url')
  const id = newId('ses')
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000)
  await db.query(`INSERT INTO sessions (id, user_id, device_id, token_hash, expires_at) VALUES ($1,$2,$3,$4,$5)`, [id, userId, device, sha256(token), expires])
  await audit(db, { actor: userId, action: 'session.created', targetType: 'session', targetId: id, meta: { device: describeDevice(userAgent) } })
  return { token, deviceId: device, expires }
}

export async function signUp(input: { email: string; password: string; displayName: string }, ctx: { userAgent: string; deviceId: string | null; ipKey: string }) {
  const parsed = signUpSchema.safeParse(input)
  if (!parsed.success) throw invalid(parsed.error.issues[0].message)
  const db = await getDb()
  await rateLimit(db, `signup:${ctx.ipKey}`, 10, 3600)
  const { email, password, displayName } = parsed.data
  const [exists] = await db.query(`SELECT 1 FROM users WHERE email = $1`, [email])
  if (exists) throw new AppError('conflict', 'An account with this email already exists. Try signing in.')
  const id = newId('usr')
  await db.query(`INSERT INTO users (id, email, password_hash, display_name) VALUES ($1,$2,$3,$4)`, [id, email, await hashPassword(password), displayName])
  await audit(db, { actor: id, action: 'user.created', targetType: 'user', targetId: id })
  await track(db, 'signup_completed', { userId: id })
  return { userId: id, ...(await createSession(db, id, ctx.deviceId, ctx.userAgent)) }
}

export async function signIn(input: { email: string; password: string }, ctx: { userAgent: string; deviceId: string | null; ipKey: string }) {
  const email = String(input.email ?? '').trim().toLowerCase()
  const db = await getDb()
  await rateLimit(db, `signin:${ctx.ipKey}`, 30, 900)
  // Per-account lockout counts failed attempts only, so a real user signing in often is never blocked.
  if (await isLimited(db, `signin-fail:${email}`, 8, 900)) throw new AppError('rate_limited', 'Too many attempts. Please wait a moment and try again.')
  const [u] = await db.query<{ id: string; password_hash: string }>(`SELECT id, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL`, [email])
  // Always run a hash so response time does not reveal whether the email exists.
  const ok = u ? await verifyPassword(String(input.password ?? ''), u.password_hash) : (await hashPassword('timing-equalizer'), false)
  if (!u || !ok) {
    await rateLimit(db, `signin-fail:${email}`, 1000, 900)
    await audit(db, { actor: u?.id ?? null, action: 'signin.failed', targetType: 'user', targetId: u?.id ?? null })
    throw invalid('That email and password don’t match.')
  }
  return { userId: u.id, ...(await createSession(db, u.id, ctx.deviceId, ctx.userAgent)) }
}

export async function userForSessionToken(token: string | undefined | null): Promise<(User & { session_id: string }) | null> {
  if (!token || token.length > 100) return null
  const db = await getDb()
  const [row] = await db.query<User & { session_id: string; last_seen_at: Date }>(
    `SELECT u.id, u.email, u.display_name, u.plan_key, u.is_platform_admin, u.retention_days, u.created_at, s.id AS session_id, s.last_seen_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.deleted_at IS NULL`,
    [sha256(token)],
  )
  if (!row) return null
  if (Date.now() - new Date(row.last_seen_at).getTime() > 5 * 60_000) {
    await db.query(`UPDATE sessions SET last_seen_at = now() WHERE id = $1`, [row.session_id])
  }
  return row
}

export async function signOut(token: string | undefined | null) {
  if (!token) return
  const db = await getDb()
  const rows = await db.query<{ id: string; user_id: string }>(`UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL RETURNING id, user_id`, [sha256(token)])
  if (rows[0]) await audit(db, { actor: rows[0].user_id, action: 'session.signed_out', targetType: 'session', targetId: rows[0].id })
}

export async function listSessions(userId: string, currentSessionId: string) {
  const db = await getDb()
  const rows = await db.query<{ id: string; created_at: Date; last_seen_at: Date; device: string | null }>(
    `SELECT s.id, s.created_at, s.last_seen_at, d.label AS device FROM sessions s LEFT JOIN devices d ON d.id = s.device_id
      WHERE s.user_id = $1 AND s.revoked_at IS NULL AND s.expires_at > now() ORDER BY s.last_seen_at DESC`,
    [userId],
  )
  return rows.map((r) => ({ ...r, current: r.id === currentSessionId }))
}

export async function revokeSession(userId: string, sessionId: string) {
  const db = await getDb()
  const r = await db.query(`UPDATE sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id`, [sessionId, userId])
  if (r.length) await audit(db, { actor: userId, action: 'session.revoked', targetType: 'session', targetId: sessionId })
}

export async function revokeOtherSessions(userId: string, keepSessionId: string) {
  const db = await getDb()
  const r = await db.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL RETURNING id`, [userId, keepSessionId])
  await audit(db, { actor: userId, action: 'session.revoked_others', targetType: 'user', targetId: userId, meta: { count: r.length } })
  return r.length
}

export async function listDevices(userId: string) {
  const db = await getDb()
  return db.query<{ id: string; label: string; first_seen_at: Date; last_seen_at: Date }>(`SELECT id, label, first_seen_at, last_seen_at FROM devices WHERE user_id = $1 ORDER BY last_seen_at DESC`, [userId])
}

export async function changePassword(userId: string, currentSessionId: string, current: string, next: string) {
  const db = await getDb()
  await rateLimit(db, `pwchange:${userId}`, 5, 900)
  const [u] = await db.query<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [userId])
  if (!u || !(await verifyPassword(current, u.password_hash))) throw invalid('Your current password is not right.')
  if (next.length < 10) throw invalid('Use at least 10 characters.')
  await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [await hashPassword(next), userId])
  await db.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`, [userId, currentSessionId])
  await audit(db, { actor: userId, action: 'user.password_changed', targetType: 'user', targetId: userId })
}
