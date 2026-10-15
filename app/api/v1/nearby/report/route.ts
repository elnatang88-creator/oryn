import { api } from '@/lib/server/api'
import { reportNearby } from '@/lib/server/services/nearby'

export const dynamic = 'force-dynamic'

/** Report abuse (also blocks). Goes to the platform team's Command Center. */
export const POST = api({ auth: true, mutation: true }, async ({ req, userId }) => {
  const body = await req.json().catch(() => ({}))
  return reportNearby(userId!, String(body?.handle ?? ''), String(body?.reason ?? ''), String(body?.details ?? ''))
})
