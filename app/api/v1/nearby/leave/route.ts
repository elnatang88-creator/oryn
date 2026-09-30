import { api } from '@/lib/server/api'
import { leaveNearby } from '@/lib/server/services/nearby'

export const dynamic = 'force-dynamic'

/** Stop being discoverable right now (screen closed, app backgrounded). */
export const POST = api({ auth: true, mutation: true }, async ({ userId }) => { await leaveNearby(userId!); return { ok: true } })
