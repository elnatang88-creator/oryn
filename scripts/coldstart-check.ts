/**
 * Simulates several servers starting at once against one empty database (what happens on a
 * serverless deploy). Every instance must come up; migrations and demo data must be applied once.
 * Usage: DATABASE_URL=... ORYN_SEED_DEMO=true npx tsx --conditions=react-server scripts/coldstart-check.ts
 */
import { getDb } from '../lib/server/db'

getDb()
  .then(async (db) => {
    const [m] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM schema_migrations`)
    const [u] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM users`)
    console.log(JSON.stringify({ ok: true, migrations: m.n, users: u.n }))
    process.exit(0)
  })
  .catch((e) => {
    console.log(JSON.stringify({ ok: false, error: String(e.message) }))
    process.exit(1)
  })
