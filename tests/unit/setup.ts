import { beforeAll } from 'vitest'
import { createPgliteDb, migrate, setDb } from '@/lib/server/db'

process.env.ORYN_SECRET = 'test-secret-test-secret-test-secret-000'
process.env.ORYN_JOBS_INLINE = 'false'

// Each test file gets its own fresh in-memory Postgres with the real migrations.
beforeAll(async () => {
  const db = await createPgliteDb()
  await migrate(db)
  setDb(db)
})
