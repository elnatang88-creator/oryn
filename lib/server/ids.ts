import crypto from 'node:crypto'

/** Opaque, unguessable identifiers. The prefix makes logs readable; the rest is 96+ bits of randomness. */
export function newId(prefix: string, bytes = 12): string {
  return `${prefix}_${crypto.randomBytes(bytes).toString('base64url')}`
}

/** Short human-safe code for printed QR/NFC destinations (no ambiguous characters). */
export function newCode(length = 10): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}
