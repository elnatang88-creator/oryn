import { NextResponse } from 'next/server'
import { api } from '@/lib/server/api'
import { appOrigin } from '@/lib/server/request'
import { googleWalletSaveLink } from '@/lib/server/services/wallet-pass'

export const dynamic = 'force-dynamic'

/** POST (it creates the pass link, so never on a GET). Redirects to Google's "Save to Wallet" page with a signed pass. 409 until Google Wallet is configured. */
export const POST = api({ auth: true, mutation: true }, async ({ userId }) => NextResponse.redirect(await googleWalletSaveLink(userId!, await appOrigin()), 303))
