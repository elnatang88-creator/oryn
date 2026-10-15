import { api } from '@/lib/server/api'
import { heartbeat } from '@/lib/server/services/nearby'

export const dynamic = 'force-dynamic'

/** Stay discoverable for two more minutes. Body: { cell?: 7-char area cell, eventId? } — never coordinates. */
export const POST = api({ auth: true, mutation: true }, async ({ req, userId }) => {
  const body = await req.json().catch(() => ({}))
  return heartbeat(userId!, { cell: body?.cell, eventId: body?.eventId })
})
