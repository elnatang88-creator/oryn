import { describe, expect, it, afterEach } from 'vitest'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { makeUser, fields } from './helpers'
import { createCapsule } from '@/lib/server/services/capsules'
import { buildPkpass, manifestFor, zipEntries, zipStore, PLACEHOLDER_PNG } from '@/lib/server/wallet-pkpass'
import { appleWalletPass } from '@/lib/server/services/wallet-pass'
import { walletStatus } from '@/lib/server/wallet'
import { AppError } from '@/lib/server/errors'

const KEYS = ['ORYN_APPLE_TEAM_ID', 'ORYN_APPLE_PASS_TYPE_ID', 'ORYN_APPLE_PASS_CERT_PEM', 'ORYN_APPLE_PASS_KEY_PEM', 'ORYN_APPLE_WWDR_PEM', 'ORYN_WALLET_PREVIEW']
afterEach(() => { for (const k of KEYS) delete process.env[k] })

function hasOpenssl() { try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); return true } catch { return false } }

/** A throwaway self-signed "Pass Type ID" certificate — test-only, generated per run, never stored. */
function selfSigned() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oryn-pkpass-test-'))
  const key = path.join(dir, 'key.pem'), cert = path.join(dir, 'cert.pem')
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=Pass Type ID: pass.test.oryn/O=ORYN test'], { stdio: 'ignore' })
  const out = { certPem: fs.readFileSync(cert, 'utf8'), keyPem: fs.readFileSync(key, 'utf8'), dir }
  return out
}

describe('Apple Wallet packaging (first-party)', () => {
  it('writes a readable STORE zip whose entries and bytes round-trip', () => {
    const files = [{ name: 'pass.json', data: Buffer.from('{"a":1}') }, { name: 'icon.png', data: PLACEHOLDER_PNG }]
    const zip = zipStore(files)
    expect(zip.readUInt32LE(0)).toBe(0x04034b50)
    expect(zipEntries(zip)).toEqual(['pass.json', 'icon.png'])
    // The central directory ends the archive and counts both entries.
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50)
    expect(zip.readUInt16LE(zip.length - 22 + 10)).toBe(2)
    // Same input → identical bytes (deterministic timestamps), so passes can be compared.
    expect(zipStore(files).equals(zip)).toBe(true)
  })

  it('the manifest lists SHA-1 of every file, as Apple requires', () => {
    const m = manifestFor([{ name: 'pass.json', data: Buffer.from('x') }])
    expect(m['pass.json']).toBe(crypto.createHash('sha1').update('x').digest('hex'))
  })

  it('without certificates the archive is an UNSIGNED preview: no signature entry and signed=false', async () => {
    const b = await buildPkpass({ formatVersion: 1, description: 'x' })
    expect(b.signed).toBe(false)
    expect(b.entries).toEqual(['pass.json', 'icon.png', 'icon@2x.png', 'logo.png', 'manifest.json'])
    expect(b.entries).not.toContain('signature')
  })

  it.skipIf(!hasOpenssl())('with a certificate chain the archive carries a DER PKCS#7 signature over manifest.json', async () => {
    const c = selfSigned()
    try {
      process.env.ORYN_APPLE_PASS_CERT_PEM = c.certPem
      process.env.ORYN_APPLE_PASS_KEY_PEM = c.keyPem
      process.env.ORYN_APPLE_WWDR_PEM = c.certPem // stands in for Apple's WWDR intermediate
      const b = await buildPkpass({ formatVersion: 1, description: 'signed' })
      expect(b.signed).toBe(true)
      expect(b.entries).toContain('signature')
      // Verify the detached signature with OpenSSL against the same (test) chain.
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oryn-pkpass-verify-'))
      const manifest = JSON.stringify(manifestFor([{ name: 'pass.json', data: Buffer.from(JSON.stringify({ formatVersion: 1, description: 'signed' })) }, { name: 'icon.png', data: PLACEHOLDER_PNG }, { name: 'icon@2x.png', data: PLACEHOLDER_PNG }, { name: 'logo.png', data: PLACEHOLDER_PNG }]))
      // Pull `signature` back out of the archive by walking the local headers.
      let p = 0, sig: Buffer | null = null
      while (p + 30 <= b.archive.length && b.archive.readUInt32LE(p) === 0x04034b50) {
        const nameLen = b.archive.readUInt16LE(p + 26), size = b.archive.readUInt32LE(p + 18)
        const name = b.archive.subarray(p + 30, p + 30 + nameLen).toString()
        if (name === 'signature') sig = Buffer.from(b.archive.subarray(p + 30 + nameLen, p + 30 + nameLen + size))
        p += 30 + nameLen + size
      }
      expect(sig).not.toBeNull()
      fs.writeFileSync(path.join(dir, 'manifest.json'), manifest)
      fs.writeFileSync(path.join(dir, 'signature'), sig!)
      fs.writeFileSync(path.join(dir, 'ca.pem'), c.certPem)
      execFileSync('openssl', ['smime', '-verify', '-inform', 'DER', '-in', path.join(dir, 'signature'), '-content', path.join(dir, 'manifest.json'), '-CAfile', path.join(dir, 'ca.pem'), '-out', '/dev/null'], { stdio: 'ignore' })
      fs.rmSync(dir, { recursive: true, force: true })
    } finally { fs.rmSync(c.dir, { recursive: true, force: true }) }
  })

  it('the service refuses to issue an Apple pass without configuration, and previews are labelled unsigned', async () => {
    const u = await makeUser('pro', 'Apple Person')
    await createCapsule(u.id, { name: 'W', mode: 'professional', display_name: 'Apple Person', fields: fields() })
    expect(walletStatus().apple.configured).toBe(false)
    await expect(appleWalletPass(u.id, 'https://oryn.test')).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'conflict')
    const prev = await appleWalletPass(u.id, 'https://oryn.test', { preview: true })
    expect(prev.signed).toBe(false)
    expect(prev.entries).not.toContain('signature')
    expect(prev.archive.toString('latin1')).toContain('UNSIGNED PREVIEW')
  })

  it.skipIf(!hasOpenssl())('with the chain configured the service issues a signed pass and records an audit event', async () => {
    const c = selfSigned()
    try {
      process.env.ORYN_APPLE_TEAM_ID = 'TEAM123456'; process.env.ORYN_APPLE_PASS_TYPE_ID = 'pass.test.oryn'
      process.env.ORYN_APPLE_PASS_CERT_PEM = c.certPem; process.env.ORYN_APPLE_PASS_KEY_PEM = c.keyPem; process.env.ORYN_APPLE_WWDR_PEM = c.certPem
      expect(walletStatus().apple.configured).toBe(true)
      const u = await makeUser('pro', 'Signed Person')
      await createCapsule(u.id, { name: 'W', mode: 'professional', display_name: 'Signed Person', fields: fields() })
      const pass = await appleWalletPass(u.id, 'https://oryn.test')
      expect(pass.signed).toBe(true)
      expect(pass.entries).toContain('signature')
      const json = pass.archive.toString('latin1')
      expect(json).toContain('pass.test.oryn'); expect(json).toContain('Signed Person'); expect(json).not.toContain('UNSIGNED')
      const { getDb } = await import('@/lib/server/db')
      const rows = await (await getDb()).query<{ meta: { platform: string; signed: boolean } }>(`SELECT meta FROM audit_events WHERE action = 'wallet.pass_issued' AND actor_user_id = $1`, [u.id])
      expect(rows[0]?.meta).toMatchObject({ platform: 'apple', signed: true })
    } finally { fs.rmSync(c.dir, { recursive: true, force: true }) }
  })
})
