import { beforeAll } from 'vitest'
import crypto from 'node:crypto'
import { createPgliteDb, createPgDb, migrate, setDb } from '@/lib/server/db'

process.env.ORYN_SECRET = 'test-secret-test-secret-test-secret-000'
process.env.ORYN_JOBS_INLINE = 'false'

/**
 * Each test file gets a fresh database with the real migrations.
 * Default: embedded Postgres (PGlite). With TEST_DATABASE_URL (a server URL whose user may create
 * databases), each file gets its own throwaway database on a real PostgreSQL server instead.
 */
beforeAll(async () => {
  const server = process.env.TEST_DATABASE_URL
  let db
  if (server) {
    const name = `oryn_t_${crypto.randomBytes(5).toString('hex')}`
    const admin = await createPgDb(server)
    await admin.query(`CREATE DATABASE ${name}`)
    const u = new URL(server)
    u.pathname = `/${name}`
    db = await createPgDb(u.toString())
  } else {
    db = await createPgliteDb()
  }
  await migrate(db)
  setDb(db)
})
