import { api } from '@/lib/server/api'
import { createCapsule, listCapsules } from '@/lib/server/services/capsules'

export const dynamic = 'force-dynamic'

// Owner view: includes private notes, because the caller is the owner.
export const GET = api({ auth: true }, async ({ userId }) => listCapsules(userId!))
export const POST = api({ auth: true, mutation: true }, async ({ req, userId }) => ({ id: await createCapsule(userId!, await req.json()) }))
