import 'server-only'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

type G = typeof globalThis & { __orynDevSecret?: string }

/**
 * The signing secret for share tokens and claim cookies. It lives outside the codebase
 * (environment / secret manager). Development gets an ephemeral random secret per process.
 */
export function signingSecret(): string {
  const s = process.env.ORYN_SECRET
  if (s && s.length >= 32) return s
  if (process.env.NODE_ENV === 'production' && process.env.ORYN_ALLOW_EMBEDDED_DB !== 'true') {
    throw new Error('ORYN_SECRET (32+ chars) must be set in production.')
  }
  const g = globalThis as G
  g.__orynDevSecret ??= process.env.ORYN_DEV_SECRET ?? devSecretFile()
  return g.__orynDevSecret
}

/** Local development keeps one random secret in .data/ (git-ignored) so share links survive restarts. */
function devSecretFile(): string {
  const dir = path.join(process.cwd(), '.data')
  const file = path.join(dir, 'dev-secret')
  try {
    return fs.readFileSync(file, 'utf8').trim()
  } catch {
    const secret = crypto.randomBytes(32).toString('hex')
    try {
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(file, secret, { mode: 0o600 })
    } catch { /* read-only file system: fall back to a per-process secret */ }
    return secret
  }
}

export function hmac(input: string): string {
  return crypto.createHmac('sha256', signingSecret()).update(input).digest('base64url')
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('base64url')
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}
