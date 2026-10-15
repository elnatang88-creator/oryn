import type { NextRequest } from 'next/server'
import { currentUser } from '@/lib/server/request'
import { getDb } from '@/lib/server/db'
import { nearbyState } from '@/lib/server/services/nearby'
import { unreadCount } from '@/lib/server/services/today'
import { registrationStats, requireCheckInStaff } from '@/lib/server/services/registrations'
import crypto from 'node:crypto'

export const dynamic = 'force-dynamic'

/**
 * Server-sent events for the signed-in member. One connection replaces several client polls:
 *   `notifications` {unread}            — whenever the unread count changes
 *   `nearby`        {hash}              — whenever the Nearby state (people, requests, acceptances) changes
 *   `checkin`       {confirmed, …}      — when ?event=<id> is given and the caller is staff
 * Authorization is checked once on connect and again per topic. The server watches the database every
 * 1.5 s (works on PGlite and PostgreSQL alike) and sends only on change; a heartbeat keeps proxies open.
 * Streams end after 15 minutes; EventSource reconnects on its own.
 */
export async function GET(req: NextRequest) {
  const user = await currentUser()
  if (!user) return new Response('unauthorized', { status: 401 })
  const eventId = req.nextUrl.searchParams.get('event')
  const topics = new Set((req.nextUrl.searchParams.get('topics') ?? 'notifications,nearby').split(',').map((s) => s.trim()).filter(Boolean))
  const db = await getDb()
  let staff = false
  if (eventId && /^evt_[A-Za-z0-9_-]{1,40}$/.test(eventId)) staff = await requireCheckInStaff(db, user.id, eventId).then(() => true).catch(() => false)

  const enc = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      let last: Record<string, string> = {}
      let closed = false
      const stop = () => { if (!closed) { closed = true; try { controller.close() } catch { /* already closed */ } } }
      req.signal.addEventListener('abort', stop)
      const deadline = Date.now() + 15 * 60_000
      send('hello', { at: Date.now() })
      const tick = async () => {
        if (closed) return
        if (Date.now() > deadline) return stop()
        try {
          const out: Record<string, unknown> = {}
          if (topics.has('notifications')) out.notifications = { unread: await unreadCount(user.id) }
          if (topics.has('nearby')) {
            const s = await nearbyState(user.id)
            const digest = crypto.createHash('sha1').update(JSON.stringify({ p: s.people.map((p) => [p.handle, p.relation]), i: s.incoming.map((i) => i.id), o: s.outgoing.map((o) => [o.id, o.status]), v: s.visibility, pr: s.present })).digest('hex')
            out.nearby = { hash: digest }
          }
          if (staff && eventId) out.checkin = await registrationStats(user.id, eventId)
          for (const [k, v] of Object.entries(out)) {
            const j = JSON.stringify(v)
            if (last[k] !== j) { last = { ...last, [k]: j }; send(k, v) }
          }
          controller.enqueue(enc.encode(`: ping\n\n`))
        } catch (e) {
          console.error('[stream]', (e as Error).message)
        }
        if (!closed) setTimeout(tick, 1500)
      }
      tick()
    },
  })
  return new Response(stream, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' } })
}
