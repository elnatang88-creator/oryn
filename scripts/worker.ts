/**
 * Background worker: `npm run worker`. Processes queued jobs (exports, scheduled deletions,
 * retention pruning) and enqueues the daily follow-up reminder sweep.
 */
import { runDueJobs, enqueue } from '../lib/server/jobs'
import { getDb } from '../lib/server/db'

async function main() {
  const db = await getDb()
  let lastDaily = ''
  console.log('[worker] started')
  for (;;) {
    const today = new Date().toISOString().slice(0, 10)
    if (today !== lastDaily) {
      await enqueue(db, 'followups.remind', {})
      lastDaily = today
    }
    const n = await runDueJobs(50)
    if (n) console.log(`[worker] ran ${n} job(s)`)
    await new Promise((r) => setTimeout(r, 5000))
  }
}

main().catch((e) => {
  console.error('[worker] fatal', e)
  process.exit(1)
})
