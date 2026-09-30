import 'server-only'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Portable database access. Production uses a company-owned PostgreSQL via DATABASE_URL.
 * Local development and tests use embedded PGlite (real Postgres compiled to WASM) so the
 * exact same SQL runs everywhere and no developer needs a personal cloud database.
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>
}

type Global = typeof globalThis & { __orynDb?: Promise<Db> }
const g = globalThis as Global

const DATE_OID = 1082

export async function createPgDb(url: string): Promise<Db> {
  const pg = await import('pg')
  pg.default.types.setTypeParser(DATE_OID, (v: string) => v)
  const pool = new pg.default.Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    ssl: process.env.DATABASE_SSL === 'disable' ? undefined : { rejectUnauthorized: process.env.DATABASE_SSL !== 'no-verify' },
  })
  const wrap = (runner: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }): Db => ({
    async query<T>(sql: string, params: unknown[] = []) {
      return (await runner.query(sql, params)).rows as T[]
    },
    async tx<T>(fn: (db: Db) => Promise<T>) {
      if (runner !== pool) return fn(wrap(runner))
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const out = await fn(wrap(client))
        await client.query('COMMIT')
        return out
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
    },
  })
  return wrap(pool)
}

export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite')
  if (dataDir) fs.mkdirSync(dataDir, { recursive: true })
  const pglite = new PGlite(dataDir, { parsers: { [DATE_OID]: (v: string) => v } })
  await pglite.waitReady
  type Runner = { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }
  // PGlite is single-connection; serialize top-level transactions so they never interleave.
  let chain: Promise<unknown> = Promise.resolve()
  const wrap = (runner: Runner, inTx: boolean): Db => ({
    async query<T>(sql: string, params: unknown[] = []) {
      if (!inTx) await chain.catch(() => {})
      return (await runner.query(sql, params)).rows as T[]
    },
    async tx<T>(fn: (db: Db) => Promise<T>) {
      if (inTx) return fn(wrap(runner, true))
      const run = chain.catch(() => {}).then(() =>
        pglite.transaction((t) => fn(wrap(t as unknown as Runner, true))),
      )
      chain = run
      return run as Promise<T>
    },
  })
  return wrap(pglite as unknown as Runner, false)
}

const MIGRATION_LOCK = 727_274 // arbitrary constant shared by every ORYN instance

/**
 * Applies pending migrations. Serverless hosts start several instances at once, so the whole run
 * happens in one transaction holding a Postgres advisory lock: one instance migrates, the others wait
 * and then find nothing left to do.
 */
export async function migrate(db: Db, after?: (t: Db) => Promise<void>): Promise<void> {
  const dir = path.join(process.cwd(), 'db', 'migrations')
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  await db.tx(async (t) => {
    await t.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK])
    await t.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`)
    const applied = new Set((await t.query<{ name: string }>('SELECT name FROM schema_migrations')).map((r) => r.name))
    for (const file of files) {
      if (applied.has(file)) continue
      const sql = fs.readFileSync(path.join(dir, file), 'utf8')
      for (const stmt of splitSql(sql)) await t.query(stmt)
      await t.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
    }
    if (after) await after(t)
  })
}

/** Splits a migration file into statements (no dollar-quoted bodies are used in migrations). */
function splitSql(sql: string): string[] {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean)
}

async function init(): Promise<Db> {
  const url = process.env.DATABASE_URL
  let db: Db
  if (url) {
    db = await createPgDb(url)
  } else {
    if (process.env.NODE_ENV === 'production' && process.env.ORYN_ALLOW_EMBEDDED_DB !== 'true') {
      throw new Error('DATABASE_URL is required in production. Set ORYN_ALLOW_EMBEDDED_DB=true only for throwaway demos.')
    }
    db = await createPgliteDb(process.env.ORYN_PGLITE_DIR ?? path.join(process.cwd(), '.data', 'pglite'))
  }
  const seed = (process.env.ORYN_SEED_DEMO ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true')) === 'true'
  // Demo data is created under the same lock, so parallel cold starts can't seed twice.
  await migrate(db, seed ? async (t) => (await import('./seed')).ensureDemoData(t) : undefined)
  return db
}

export function getDb(): Promise<Db> {
  if (!g.__orynDb) {
    g.__orynDb = init().catch((e) => {
      g.__orynDb = undefined
      throw e
    })
  }
  return g.__orynDb
}

/** Test hook: install a prepared database as the process-wide instance. */
export function setDb(db: Db) {
  g.__orynDb = Promise.resolve(db)
}
