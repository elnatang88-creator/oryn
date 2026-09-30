import { api } from '@/lib/server/api'
import { nearbyState } from '@/lib/server/services/nearby'

export const dynamic = 'force-dynamic'

/** Nearby state for the signed-in member. Polled every few seconds while Share/Nearby is open. */
export const GET = api({ auth: true }, async ({ userId }) => nearbyState(userId!))
