import { api } from '@/lib/server/api'
import { checkIn, registrationStats } from '@/lib/server/services/registrations'

export const dynamic = 'force-dynamic'

/** Staff only (checked in the service). POST {ref, method} → atomic check-in verdict. GET → live counts. */
export const POST = api<{ id: string }>({ auth: true, mutation: true }, async ({ req, params, userId }) => {
  const body = await req.json().catch(() => ({}))
  return checkIn(userId!, params.id, String(body?.ref ?? ''), body?.method === 'manual' ? 'manual' : 'scan')
})
export const GET = api<{ id: string }>({ auth: true }, async ({ params, userId }) => registrationStats(userId!, params.id))
