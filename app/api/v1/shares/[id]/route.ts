import { api } from '@/lib/server/api'
import { getShareForOwner, revokeShare } from '@/lib/server/services/sharing'

export const dynamic = 'force-dynamic'

export const GET = api<{ id: string }>({ auth: true }, async ({ userId, params }) => getShareForOwner(userId!, params.id))
/** Revoke: the link stops working on its next request. */
export const DELETE = api<{ id: string }>({ auth: true, mutation: true }, async ({ userId, params }) => {
  await revokeShare(userId!, params.id)
  return { revoked: true }
})
