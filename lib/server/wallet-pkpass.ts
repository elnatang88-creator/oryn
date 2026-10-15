import 'server-only'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/**
 * Apple Wallet packaging (first-party, no SaaS). A .pkpass is a ZIP of pass.json + images + manifest.json
 * (SHA-1 of every file) + signature (PKCS#7 detached signature of manifest.json by the Pass Type ID certificate,
 * chained to Apple's WWDR certificate). Node has no CMS signer, so signing shells out to OpenSSL when the
 * certificate, key and WWDR PEMs are configured. Without them we can still build a *development preview*
 * archive (unsigned, clearly labelled); it will not install on a device and is never presented as valid.
 */
const exec = promisify(execFile)

export interface PassFile { name: string; data: Buffer }

/** Minimal ZIP writer (STORE method, no compression). pkpass readers accept it; sizes stay tiny. */
export function zipStore(files: PassFile[]): Buffer {
  const chunks: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  const dosTime = Buffer.from([0, 0, 0x21, 0x00]) // 00:00, 1980-01-01 — deterministic archives
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8')
    const crc = crc32(f.data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8)
    dosTime.copy(local, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(f.data.length, 18); local.writeUInt32LE(f.data.length, 22)
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28)
    chunks.push(local, name, f.data)
    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8); cd.writeUInt16LE(0, 10)
    dosTime.copy(cd, 12); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(f.data.length, 20); cd.writeUInt32LE(f.data.length, 24)
    cd.writeUInt16LE(name.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32); cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(offset, 42)
    central.push(cd, name)
    offset += local.length + name.length + f.data.length
  }
  const cdBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20)
  return Buffer.concat([...chunks, cdBuf, end])
}

let table: Uint32Array | null = null
function crc32(buf: Buffer) {
  if (!table) { table = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0 } }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** Lists every entry name in a ZIP produced here (used by tests and the preview endpoint). */
export function zipEntries(buf: Buffer): string[] {
  const names: string[] = []
  let p = 0
  while (p + 30 <= buf.length && buf.readUInt32LE(p) === 0x04034b50) {
    const nameLen = buf.readUInt16LE(p + 26), extra = buf.readUInt16LE(p + 28), size = buf.readUInt32LE(p + 18)
    names.push(buf.subarray(p + 30, p + 30 + nameLen).toString('utf8'))
    p += 30 + nameLen + extra + size
  }
  return names
}

export function manifestFor(files: PassFile[]) {
  return Object.fromEntries(files.map((f) => [f.name, crypto.createHash('sha1').update(f.data).digest('hex')]))
}

/** A 1×1 PNG so the archive has the images Apple requires (icon.png, icon@2x.png, logo.png); real art replaces these. */
export const PLACEHOLDER_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

export interface AppleSigningConfig { certPem: string; keyPem: string; wwdrPem: string }

export function appleSigningConfig(): AppleSigningConfig | null {
  const certPem = process.env.ORYN_APPLE_PASS_CERT_PEM?.replace(/\\n/g, '\n'), keyPem = process.env.ORYN_APPLE_PASS_KEY_PEM?.replace(/\\n/g, '\n'), wwdrPem = process.env.ORYN_APPLE_WWDR_PEM?.replace(/\\n/g, '\n')
  return certPem && keyPem && wwdrPem ? { certPem, keyPem, wwdrPem } : null
}

/** PKCS#7 detached signature of the manifest via OpenSSL (`smime -sign -binary -outform DER`). */
export async function signManifest(manifest: Buffer, cfg: AppleSigningConfig): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'oryn-pass-'))
  try {
    const p = (n: string) => path.join(dir, n)
    await Promise.all([fs.writeFile(p('cert.pem'), cfg.certPem, { mode: 0o600 }), fs.writeFile(p('key.pem'), cfg.keyPem, { mode: 0o600 }), fs.writeFile(p('wwdr.pem'), cfg.wwdrPem, { mode: 0o600 }), fs.writeFile(p('manifest.json'), manifest)])
    await exec('openssl', ['smime', '-sign', '-signer', p('cert.pem'), '-inkey', p('key.pem'), '-certfile', p('wwdr.pem'), '-in', p('manifest.json'), '-out', p('signature'), '-outform', 'DER', '-binary'])
    return await fs.readFile(p('signature'))
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

export interface BuiltPass { archive: Buffer; signed: boolean; entries: string[] }

/** Builds the archive. `signed: false` means a development preview that will NOT install on a device. */
export async function buildPkpass(passJson: object, images: PassFile[] = []): Promise<BuiltPass> {
  const files: PassFile[] = [
    { name: 'pass.json', data: Buffer.from(JSON.stringify(passJson)) },
    ...(images.length ? images : [{ name: 'icon.png', data: PLACEHOLDER_PNG }, { name: 'icon@2x.png', data: PLACEHOLDER_PNG }, { name: 'logo.png', data: PLACEHOLDER_PNG }]),
  ]
  const manifest = Buffer.from(JSON.stringify(manifestFor(files)))
  const out: PassFile[] = [...files, { name: 'manifest.json', data: manifest }]
  const cfg = appleSigningConfig()
  let signed = false
  if (cfg) {
    out.push({ name: 'signature', data: await signManifest(manifest, cfg) })
    signed = true
  }
  const archive = zipStore(out)
  return { archive, signed, entries: zipEntries(archive) }
}
