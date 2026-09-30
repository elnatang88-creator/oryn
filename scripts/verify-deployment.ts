/**
 * Staging / production readiness check. Prints PASS / FAIL / WARN per item and never prints secret values.
 *
 *   Environment + database (run where the app's env vars are set, e.g. `vercel env pull` then):
 *     npx tsx --conditions=react-server scripts/verify-deployment.ts env
 *   Live deployment (read-only HTTP checks, safe against staging or production):
 *     npx tsx --conditions=react-server scripts/verify-deployment.ts http https://staging.example.com
 *
 * Exit code 1 if any FAIL.
 */
import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'

type Result = { status: 'PASS' | 'FAIL' | 'WARN'; check: string; detail?: string }
const results: Result[] = []
const pass = (check: string, detail?: string) => results.push({ status: 'PASS', check, detail })
const fail = (check: string, detail?: string) => results.push({ status: 'FAIL', check, detail })
const warn = (check: string, detail?: string) => results.push({ status: 'WARN', check, detail })

async function checkEnv() {
  const e = process.env
  const prodLike = (e.ORYN_TARGET ?? 'production') !== 'demo'
  if (e.DATABASE_URL) pass('DATABASE_URL is set')
  else fail('DATABASE_URL is set', 'required; the embedded database must not be used on a server')
  if ((e.ORYN_SECRET ?? '').length >= 32) pass('ORYN_SECRET is set and ≥ 32 characters')
  else fail('ORYN_SECRET is set and ≥ 32 characters')
  if (e.NEXT_PUBLIC_APP_URL?.startsWith('https://')) pass('NEXT_PUBLIC_APP_URL uses https')
  else warn('NEXT_PUBLIC_APP_URL uses https', e.NEXT_PUBLIC_APP_URL ? 'not https' : 'unset: links use the request host (acceptable for previews only)')
  if (e.CRON_SECRET && e.CRON_SECRET.length >= 20) pass('CRON_SECRET is set')
  else fail('CRON_SECRET is set', 'background jobs (deletion, reminders) will not run')
  for (const [k, bad] of [['ORYN_ALLOW_EMBEDDED_DB', 'true'], ['ORYN_INSECURE_COOKIES', 'true'], ['DATABASE_SSL', 'disable']] as const) {
    if (e[k] === bad) fail(`${k} is not "${bad}"`, 'test-only setting')
    else pass(`${k} is not "${bad}"`)
  }
  if (e.ORYN_SEED_DEMO === 'true') (prodLike ? fail : warn)('Demo data is off', 'ORYN_SEED_DEMO=true creates fictional demo accounts')
  else pass('Demo data is off')
  if (e.ORYN_DELETION_GRACE_DAYS && e.ORYN_DELETION_GRACE_DAYS !== '7') warn('Deletion grace period is the default 7 days', `set to ${e.ORYN_DELETION_GRACE_DAYS}`)
  else pass('Deletion grace period is the default 7 days')

  if (!e.DATABASE_URL) return
  const client = new pg.Client({ connectionString: e.DATABASE_URL, ssl: e.DATABASE_SSL === 'disable' ? undefined : { rejectUnauthorized: e.DATABASE_SSL !== 'no-verify' } })
  try {
    await client.connect()
    pass('Database is reachable')
    const role = (await client.query(`SELECT rolsuper, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = current_user`)).rows[0]
    if (role?.rolsuper) fail('App database user is not a superuser', 'use a least-privilege role that owns only the ORYN schema')
    else pass('App database user is not a superuser')
    if (role?.rolcreaterole) warn('App database user cannot create roles')
    else pass('App database user cannot create roles')
    const ssl = (await client.query(`SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()`).catch(() => ({ rows: [] }))).rows[0]
    if (ssl?.ssl) pass('Database connection uses TLS')
    else (e.DATABASE_SSL === 'disable' ? fail : warn)('Database connection uses TLS')
    const files = fs.readdirSync(path.join(process.cwd(), 'db', 'migrations')).filter((f) => f.endsWith('.sql'))
    const applied = await client.query(`SELECT name FROM schema_migrations`).then((r) => r.rows.map((x) => x.name)).catch(() => null)
    if (!applied) warn('Migrations applied', 'schema_migrations missing: run `npm run db:migrate` before traffic')
    else if (files.every((f) => applied.includes(f))) pass('Migrations applied', `${applied.length}/${files.length}`)
    else fail('Migrations applied', `${applied.length}/${files.length}`)
    const demo = await client.query(`SELECT count(*)::int AS n FROM users WHERE email LIKE '%@oryn.local'`).then((r) => r.rows[0].n).catch(() => 0)
    if (demo > 0) (prodLike ? fail : warn)('No demo accounts in this database', `${demo} found`)
    else pass('No demo accounts in this database')
  } catch (err) {
    fail('Database is reachable', (err as Error).message.split('\n')[0])
  } finally {
    await client.end().catch(() => {})
  }
}

async function checkHttp(base: string) {
  const url = (p: string) => new URL(p, base).toString()
  const get = (p: string, init: RequestInit = {}) => fetch(url(p), { redirect: 'manual', ...init })
  const https = base.startsWith('https://')

  const health = await get('/api/health').catch((e) => e as Error)
  if (health instanceof Error) return fail('Site is reachable', health.message)
  const body = await health.text()
  if (health.status === 200 && body.includes('"ok":true')) pass('/api/health reports the database is up')
  else fail('/api/health reports the database is up', `HTTP ${health.status}${health.status === 401 ? ' (deployment protection is on: recipients could not open links)' : ''}`)

  const home = await get('/')
  const h = home.headers
  const has = (name: string, value?: string) => (value ? (h.get(name) ?? '').includes(value) : h.has(name))
  ;(has('content-security-policy', "frame-ancestors 'none'") ? pass : fail)('Content-Security-Policy set')
  ;(has('x-content-type-options', 'nosniff') ? pass : fail)('X-Content-Type-Options: nosniff')
  ;(has('x-frame-options', 'DENY') ? pass : fail)('X-Frame-Options: DENY')
  if (https) (has('strict-transport-security') ? pass : fail)('HSTS on https')
  else warn('HSTS on https', 'site is not served over https')

  const today = await get('/today')
  ;(today.status >= 300 && today.status < 400 && (today.headers.get('location') ?? '').includes('/signin') ? pass : fail)('Workspace redirects to sign-in when signed out', `HTTP ${today.status}`)
  const api = await get('/api/v1/capsules')
  ;(api.status === 401 ? pass : fail)('API refuses anonymous callers', `HTTP ${api.status}`)
  const csrf = await get('/api/v1/shares', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' })
  ;(csrf.status === 403 ? pass : fail)('API refuses cross-site POST', `HTTP ${csrf.status}`)
  const jobs = await get('/api/jobs')
  ;(jobs.status === 401 ? pass : fail)('Job endpoint refuses callers without CRON_SECRET', `HTTP ${jobs.status}`)
  const bad = await get('/c/not-a-real-link')
  const badText = await bad.text()
  ;(badText.includes('doesn’t open a capsule') ? pass : fail)('Unknown capsule link shows the plain message')
  ;((bad.headers.get('cache-control') ?? '').includes('no-store') ? pass : fail)('Capsule pages are not cached')
  ;((bad.headers.get('x-robots-tag') ?? '').includes('noindex') ? pass : fail)('Capsule pages are not indexed')
  const demo = await (await get('/q/harbordemo')).status
  if (demo >= 300 && demo < 400) warn('Demo booth /q/harbordemo is not live', 'demo data is seeded here: fine for a demo, not for production')
  else pass('Demo booth /q/harbordemo is not live')
}

async function main() {
  const [mode, base] = process.argv.slice(2)
  if (mode === 'env') await checkEnv()
  else if (mode === 'http' && base) await checkHttp(base)
  else {
    console.log('usage: verify-deployment.ts env | http <base-url>')
    process.exit(2)
  }
  for (const r of results) console.log(`${r.status.padEnd(4)}  ${r.check}${r.detail ? ` — ${r.detail}` : ''}`)
  const f = results.filter((r) => r.status === 'FAIL').length
  console.log(`\n${results.length} checks · ${results.length - f} not failing · ${f} failing`)
  process.exit(f ? 1 : 0)
}

main()
