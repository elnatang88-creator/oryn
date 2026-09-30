/** Applies db/migrations to DATABASE_URL (or the local embedded database). Run on every deploy before traffic. */
import { getDb } from '../lib/server/db'

getDb()
  .then(() => { console.log('[migrate] up to date'); process.exit(0) })
  .catch((e) => { console.error('[migrate] failed', e); process.exit(1) })
