import { api } from '@/lib/server/api'
import { resolveShare } from '@/lib/server/services/sharing'

export const dynamic = 'force-dynamic'

/** Recipient-safe projection for native clients and stations. Never records a view (clients report opens separately in a later version). */
export const GET = api<{ token: string }>({}, async ({ params, req }) => {
  const layer = req.nextUrl.searchParams.get('layer') === 'expanded' ? 'expanded' : 'instant'
  const r = await resolveShare(params.token, { layer, claimToken: req.cookies.get('oryn_claim')?.value ?? null })
  return r.status === 'ok' ? { status: 'ok', view: r.view } : { status: r.status }
})
