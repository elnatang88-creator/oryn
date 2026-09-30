import { api } from '@/lib/server/api'
import { recordFieldTap } from '@/lib/server/services/viewers'
import { requestContext } from '@/lib/server/request'

export const dynamic = 'force-dynamic'

/** Anonymous "which detail interested them" signal. Same-origin only, rate-limited, never identifies the tapper. */
export const POST = api<{ token: string }>({ mutation: true }, async ({ req, params }) => {
  const body = await req.json().catch(() => ({}))
  const ctx = await requestContext()
  await recordFieldTap(params.token, String(body?.fieldId ?? ''), { claimToken: req.cookies.get('oryn_claim')?.value ?? null, ipKey: ctx.ipKey })
  return { ok: true }
})
