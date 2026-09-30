import { api } from '@/lib/server/api'
import { listShares, startShare } from '@/lib/server/services/sharing'

export const dynamic = 'force-dynamic'

export const GET = api({ auth: true }, async ({ userId }) => listShares(userId!, { activeOnly: true }))
export const POST = api({ auth: true, mutation: true }, async ({ req, userId }) => startShare(userId!, await req.json()))
