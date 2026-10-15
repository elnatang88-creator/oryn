import 'server-only'
import { hmac, safeEqual } from './secrets'

/**
 * Share access token: `<shareSessionId>.<expiry>.<signature>`.
 * - The signature (HMAC-SHA256, truncated to 128 bits) stops guessing and tampering before any DB work.
 * - The expiry is signed in, so an expired link is rejected even if the DB were unreachable.
 * - The server-side share session remains the source of truth (revocation, one-time claim, edits).
 */
export function signShareToken(sessionId: string, expiresAt: Date | null): string {
  const exp = expiresAt ? Math.floor(expiresAt.getTime() / 1000).toString(36) : '0'
  return `${sessionId}.${exp}.${sig(sessionId, exp)}`
}

export type TokenCheck = { ok: true; sessionId: string; expired: boolean } | { ok: false }

export function verifyShareToken(token: string, now = Date.now()): TokenCheck {
  if (typeof token !== 'string' || token.length > 120) return { ok: false }
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false }
  const [sessionId, exp, given] = parts
  if (!/^s_[A-Za-z0-9_-]{16,}$/.test(sessionId) || !/^[0-9a-z]+$/.test(exp)) return { ok: false }
  if (!safeEqual(sig(sessionId, exp), given)) return { ok: false }
  const expSec = parseInt(exp, 36)
  return { ok: true, sessionId, expired: expSec > 0 && expSec * 1000 <= now }
}

function sig(sessionId: string, exp: string) {
  return hmac(`share:v1:${sessionId}:${exp}`).slice(0, 22)
}

/** One-time capsules bind to the first browser that opens them via a random claim cookie. */
export function claimHash(sessionId: string, claimToken: string) {
  return hmac(`claim:v1:${sessionId}:${claimToken}`)
}
