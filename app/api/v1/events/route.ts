import { api } from '@/lib/server/api'
import { getDb } from '@/lib/server/db'
import { track } from '@/lib/server/analytics'
import { rateLimit } from '@/lib/server/ratelimit'
import { CLIENT_EVENTS, cleanProps, type ClientEvent } from '@/lib/analytics-events'

export const dynamic = 'force-dynamic'

/** In-app product events from the signed-in member's own client. Allow-listed names; ids/enums only. */
export const POST = api({ auth: true, mutation: true }, async ({ req, userId }) => {
  const body = await req.json().catch(() => ({}))
  const name = String(body?.name ?? '')
  if (!CLIENT_EVENTS.includes(name as ClientEvent)) return { ok: false }
  const db = await getDb()
  await rateLimit(db, `events:${userId}`, 900, 3600)
  const sessionId = typeof body?.sessionId === 'string' && /^[A-Za-z0-9_-]{8,40}$/.test(body.sessionId) ? body.sessionId : null
  await track(db, name as ClientEvent, { userId, props: cleanProps(body?.props), sessionId })
  return { ok: true }
})
