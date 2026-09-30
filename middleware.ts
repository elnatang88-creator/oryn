import { NextResponse, type NextRequest } from 'next/server'

/**
 * Recipient browsers get a random, first-party claim cookie on capsule links. It carries no identity;
 * it only lets a one-time capsule stay open for the browser that opened it first.
 */
export function middleware(req: NextRequest) {
  if (req.cookies.get('oryn_claim')) return NextResponse.next()
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  req.cookies.set('oryn_claim', token)
  const res = NextResponse.next({ request: { headers: req.headers } })
  res.cookies.set('oryn_claim', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.ORYN_INSECURE_COOKIES !== 'true',
    path: '/',
    maxAge: 30 * 86400,
  })
  return res
}

export const config = { matcher: ['/c/:path*', '/q/:path*'] }
