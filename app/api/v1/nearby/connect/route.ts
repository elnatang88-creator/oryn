import { api } from '@/lib/server/api'
import { requestNearby } from '@/lib/server/services/nearby'

export const dynamic = 'force-dynamic'

export const POST = api({ auth: true, mutation: true }, async ({ req, userId }) => {
  const body = await req.json().catch(() => ({}))
  return requestNearby(userId!, String(body?.handle ?? ''))
})
