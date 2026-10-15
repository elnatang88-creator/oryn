#!/usr/bin/env node
/**
 * One command to open ORYN on a phone that is on the same Wi-Fi as this computer:
 *   npm run demo:iphone
 * It prepares .env.local (secrets generated locally, never committed), builds once, starts the production
 * server on every network interface, and prints the address as a QR code to scan with the phone's camera.
 * Plain http on a private network — so cookies are allowed over http (ORYN_INSECURE_COOKIES) and the embedded
 * database is allowed (ORYN_ALLOW_EMBEDDED_DB). This is a demo setting, not a deployment: see DEPLOYMENT.md.
 */
import { spawn, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const root = process.cwd()
const port = Number(process.env.PORT ?? 3000)
const args = new Set(process.argv.slice(2))
const require = createRequire(import.meta.url)

// 1. .env.local — created once; existing values are kept.
const envPath = path.join(root, '.env.local')
const env = {}
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1') }
const added = []
const ensure = (k, v) => { if (!env[k]) { env[k] = v; added.push(k) } }
ensure('ORYN_SECRET', crypto.randomBytes(32).toString('base64url'))
ensure('CRON_SECRET', crypto.randomBytes(24).toString('base64url'))
ensure('ORYN_DEMO_PASSWORD', crypto.randomBytes(9).toString('base64url'))
if (added.length) {
  fs.writeFileSync(envPath, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 })
  console.log(`Wrote ${added.join(', ')} to .env.local (kept out of git).`)
}

// 2. The address the phone will use.
const ip = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address
if (!ip) { console.error('No Wi-Fi/LAN address found. Connect this computer to the same Wi-Fi as the phone and try again.'); process.exit(1) }
const url = `http://${ip}:${port}`

// 3. Build once (or when asked).
const built = fs.existsSync(path.join(root, '.next', 'BUILD_ID'))
if (!built || args.has('--build')) {
  console.log(built ? 'Rebuilding…' : 'First run: building the app (one to two minutes)…')
  const b = spawnSync('npx', ['next', 'build'], { stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } })
  if (b.status !== 0) process.exit(b.status ?? 1)
}

// 4. Start.
const runtime = {
  ...process.env, ...env,
  NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
  ORYN_PUBLIC_URL: url, ORYN_ALLOW_EMBEDDED_DB: 'true', ORYN_INSECURE_COOKIES: 'true', ORYN_SEED_DEMO: env.ORYN_SEED_DEMO ?? 'true', ORYN_JOBS_INLINE: 'true', EMAIL_TRANSPORT: env.EMAIL_TRANSPORT ?? 'log',
}
const server = spawn('npx', ['next', 'start', '-H', '0.0.0.0', '-p', String(port)], { stdio: ['ignore', 'pipe', 'inherit'], env: runtime })
let ready = false
server.stdout.on('data', async (chunk) => {
  process.stdout.write(chunk)
  if (!ready && /Ready in|started server|Local:/.test(String(chunk))) {
    ready = true
    const QRCode = require('qrcode')
    console.log('\n──────────────────────────────────────────────────────────')
    console.log(`  Open on your iPhone (same Wi-Fi):  ${url}/welcome`)
    console.log('  Or point the iPhone camera at this code:\n')
    console.log(await QRCode.toString(`${url}/welcome`, { type: 'terminal', small: true }))
    console.log(`  Demo account (fictional data): demo@oryn.local`)
    console.log(`  Demo password: ${env.ORYN_DEMO_PASSWORD}   ← shown only here, never in the app`)
    console.log('  Stop with Ctrl+C.  Rebuild after code changes: npm run demo:iphone -- --build')
    console.log('──────────────────────────────────────────────────────────\n')
  }
})
server.on('exit', (code) => process.exit(code ?? 0))
process.on('SIGINT', () => server.kill('SIGINT'))
