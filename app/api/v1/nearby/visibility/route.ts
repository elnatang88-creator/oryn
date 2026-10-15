import { api } from '@/lib/server/api'
import { setNearbyVisibility } from '@/lib/server/services/nearby'

export const dynamic = 'force-dynamic'

export const POST = api({ auth: true, mutation: true }, async ({ req, userId }) => {
  const body = await req.json().catch(() => ({}))
  await setNearbyVisibility(userId!, String(body?.visibility ?? ''))
  return { ok: true }
})
