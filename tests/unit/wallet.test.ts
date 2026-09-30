import { describe, expect, it, afterEach } from 'vitest'
import crypto from 'node:crypto'
import { makeUser, fields } from './helpers'
import { createCapsule } from '@/lib/server/services/capsules'
import { resolveShare } from '@/lib/server/services/sharing'
import { walletLink, walletCardData, googleWalletSaveLink } from '@/lib/server/services/wallet-pass'
import { applePassJson, googleGenericObject, googleSaveUrl, walletStatus } from '@/lib/server/wallet'
import { AppError } from '@/lib/server/errors'

const KEYS = ['ORYN_GOOGLE_WALLET_ISSUER_ID', 'ORYN_GOOGLE_WALLET_SA_EMAIL', 'ORYN_GOOGLE_WALLET_SA_KEY_PEM']
afterEach(() => { for (const k of KEYS) delete process.env[k] })

describe('Wallet', () => {
  it('never claims to be ready when it is not: Apple always needs the signing service; Google needs its keys', () => {
    const s = walletStatus()
    expect(s.apple.configured).toBe(false)
    expect(s.apple.missing.join(' ')).toContain('Pass signing')
    expect(s.google.configured).toBe(false)
    expect(s.google.missing).toHaveLength(3)
  })

  it('the pass carries only card-face data and a working, non-expiring link — never hidden details or notes', async () => {
    const u = await makeUser('pro', 'Wallet Person')
    await createCapsule(u.id, { name: 'Work', mode: 'professional', display_name: 'Wallet Person', headline: 'Designer', fields: fields(), private_note: 'PRIVATE-wallet' })
    const link = await walletLink(u.id)
    expect((await walletLink(u.id)).shareId).toBe(link.shareId) // reused, not a new link per tap
    const token = link.url.split('/c/')[1]
    expect((await resolveShare(token)).status).toBe('ok')
    const data = await walletCardData(u.id, link.capsuleId, link.url)
    const apple = applePassJson(data, { serial: link.shareId, passTypeId: 'pass.test', teamId: 'TEAM' })
    const google = googleGenericObject(data, { issuerId: '338800000', objectSuffix: link.shareId })
    for (const obj of [apple, google]) {
      const json = JSON.stringify(obj)
      expect(json).toContain('Wallet Person')
      expect(json).toContain(link.url)
      expect(json).not.toContain('555 010 9999')
      expect(json).not.toContain('me@example.com')
      expect(json).not.toContain('PRIVATE-')
    }
    expect(apple.generic.primaryFields[0].value).toBe('Wallet Person')
    expect(apple.barcodes[0].format).toBe('PKBarcodeFormatQR')
  })

  it('wallet passes are a Pro capability, enforced on the server', async () => {
    const u = await makeUser('free', 'Free Wallet')
    await createCapsule(u.id, { name: 'W', mode: 'professional', display_name: 'Free Wallet', fields: fields() })
    await expect(walletLink(u.id)).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'plan')
  })

  it('Google: refuses without configuration; with it, produces a save link whose RS256 signature verifies', async () => {
    const u = await makeUser('pro', 'Google Person')
    await createCapsule(u.id, { name: 'W', mode: 'professional', display_name: 'Google Person', fields: fields() })
    await expect(googleWalletSaveLink(u.id, 'https://oryn.test')).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'conflict')

    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    process.env.ORYN_GOOGLE_WALLET_ISSUER_ID = '3388000000000000000'
    process.env.ORYN_GOOGLE_WALLET_SA_EMAIL = 'wallet@oryn-test.iam.gserviceaccount.com'
    process.env.ORYN_GOOGLE_WALLET_SA_KEY_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    expect(walletStatus().google.configured).toBe(true)
    const url = await googleWalletSaveLink(u.id, 'https://oryn.test')
    expect(url.startsWith('https://pay.google.com/gp/v/save/')).toBe(true)
    const [h, p, s] = url.split('/save/')[1].split('.')
    expect(crypto.createVerify('RSA-SHA256').update(`${h}.${p}`).verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true)
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString())
    expect(payload).toMatchObject({ aud: 'google', typ: 'savetowallet', origins: ['https://oryn.test'] })
    expect(payload.payload.genericObjects[0].header.defaultValue.value).toBe('Google Person')
    // The object on its own also round-trips through the signer.
    expect(googleSaveUrl(payload.payload.genericObjects[0], { serviceAccountEmail: 'x', privateKeyPem: process.env.ORYN_GOOGLE_WALLET_SA_KEY_PEM, origin: 'https://o' })).toContain('/save/')
  })
})
