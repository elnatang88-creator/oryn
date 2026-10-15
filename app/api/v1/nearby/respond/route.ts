import { api } from '@/lib/server/api'
import { respondToRequest } from '@/lib/server/services/connections'

export const dynamic = 'force-dynamic'

/** Accept or "Not now". Declining is silent to the other person. Ownership is checked in the service. */
export const POST = api({ auth: true, mutation: true }, async ({ req, userId }) => {
  const body = await req.json().catch(() => ({}))
  return respondToRequest(userId!, String(body?.requestId ?? ''), body?.accept === true)
})
