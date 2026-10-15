import { NextResponse } from 'next/server'
import { api } from '@/lib/server/api'
import { appOrigin } from '@/lib/server/request'
import { AppError } from '@/lib/server/errors'
import { relativeRedirect } from '@/lib/server/redirect'
import { appleWalletPass } from '@/lib/server/services/wallet-pass'

export const dynamic = 'force-dynamic'

/**
 * POST (it creates the pass link, so never on a GET). Returns a signed .pkpass the phone's Wallet opens, or
 * redirects back with a clear error. `preview=1` returns an UNSIGNED development archive (zip media type,
 * ".preview.pkpass.zip" name) so nothing tries to install it and nobody mistakes it for a valid pass.
 */
export const POST = api({ auth: true, mutation: true }, async ({ req, userId }) => {
  const form = await req.formData().catch(() => null)
  const back = String(form?.get('back') ?? '')
  const preview = String(form?.get('preview') ?? '') === '1'
  const safeBack = /^(\/share\/[A-Za-z0-9_-]+\/wallet|\/wallet)$/.test(back) ? back : null
  try {
    const pass = await appleWalletPass(userId!, await appOrigin(), { preview })
    const body = new Uint8Array(pass.archive)
    if (!pass.signed) {
      return new NextResponse(body, { status: 200, headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="oryn-card-${pass.serial.slice(-6)}.preview.pkpass.zip"`, 'x-oryn-pass': 'unsigned-preview', 'cache-control': 'private, no-store' } })
    }
    return new NextResponse(body, { status: 200, headers: { 'content-type': 'application/vnd.apple.pkpass', 'content-disposition': `attachment; filename="oryn-card.pkpass"`, 'x-oryn-pass': 'signed', 'cache-control': 'private, no-store' } })
  } catch (e) {
    if (e instanceof AppError && safeBack) return relativeRedirect(`${safeBack}?error=apple`, 303)
    throw e
  }
})
