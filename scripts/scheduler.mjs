// ORYN job scheduler: calls the app's job endpoint every minute, plus the daily sweep once a day.
// Plain Node (no dependencies) so it runs from the same container image as the app.
const base = process.env.ORYN_INTERNAL_URL || 'http://app:3000'
const secret = process.env.CRON_SECRET
if (!secret) { console.error('[scheduler] CRON_SECRET is not set'); process.exit(1) }
let lastDaily = ''
async function tick() {
  const today = new Date().toISOString().slice(0, 10)
  const daily = today !== lastDaily
  try {
    const r = await fetch(`${base}/api/jobs${daily ? '?daily=1' : ''}`, { headers: { authorization: `Bearer ${secret}` } })
    if (r.ok) { if (daily) lastDaily = today; const { ran } = await r.json(); if (ran) console.log(`[scheduler] ran ${ran} job(s)`) }
    else console.error('[scheduler] job endpoint answered', r.status)
  } catch (e) { console.error('[scheduler] app not reachable yet:', e.message) }
}
tick()
setInterval(tick, 60_000)
