import { api } from '@/lib/server/api'
import { blockNearby } from '@/lib/server/services/nearby'

export const dynamic = 'force-dynamic'

/** Block a nearby member by their rotating handle. Private: they are never told. */
export const POST = api({ auth: true, mutation: true }, async ({ req, userId }) => {
  const body = await req.json().catch(() => ({}))
  return blockNearby(userId!, String(body?.handle ?? ''))
})
