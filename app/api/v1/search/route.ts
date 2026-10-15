import { api } from '@/lib/server/api'
import { globalSearch } from '@/lib/server/services/search'

export const dynamic = 'force-dynamic'

export const GET = api({ auth: true }, async ({ req, userId }) => globalSearch(userId!, req.nextUrl.searchParams.get('q') ?? ''))
