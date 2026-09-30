import { NextResponse } from 'next/server'
import { api } from '@/lib/server/api'
import { appOrigin } from '@/lib/server/request'
import { AppError } from '@/lib/server/errors'
import { relativeRedirect } from '@/lib/server/redirect'
import { googleWalletSaveLink } from '@/lib/server/services/wallet-pass'

export const dynamic = 'force-dynamic'

/**
 * POST (it creates the pass link, so never on a GET). Redirects to Google's "Save to Wallet" page with a signed
 * pass, or back to the Wallet screen with a clear error. ORYN never claims the pass was added — Google says so.
 */
export const POST = api({ auth: true, mutation: true }, async ({ req, userId }) => {
  const form = await req.formData().catch(() => null)
  const back = String(form?.get('back') ?? '')
  const safeBack = /^\/share\/[A-Za-z0-9_-]+\/wallet$/.test(back) ? back : null
  try {
    return NextResponse.redirect(await googleWalletSaveLink(userId!, await appOrigin()), 303)
  } catch (e) {
    if (e instanceof AppError && safeBack) return relativeRedirect(`${safeBack}?error=google`, 303)
    throw e
  }
})
