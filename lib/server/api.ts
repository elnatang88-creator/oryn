import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { AppError } from './errors'
import { currentUser } from './request'

const STATUS: Record<AppError['code'], number> = { not_found: 404, forbidden: 403, invalid: 400, plan: 402, rate_limited: 429, unauthenticated: 401, conflict: 409 }

/**
 * Versioned JSON API (/api/v1) for future native apps, stations, wallet passes and partners.
 * v1 authenticates with the session cookie; token auth for native clients is on the roadmap.
 * Mutations require a same-origin request (CSRF defence for cookie auth).
 */
export function api<P>(opts: { auth?: boolean; mutation?: boolean }, fn: (ctx: { req: NextRequest; params: P; userId: string | null }) => Promise<unknown>) {
  return async (req: NextRequest, { params }: { params: Promise<P> }) => {
    try {
      if (opts.mutation) {
        const origin = req.headers.get('origin')
        if (!origin || new URL(origin).host !== req.headers.get('host')) throw new AppError('forbidden', 'Cross-site request refused.')
      }
      const user = opts.auth ? await currentUser() : null
      if (opts.auth && !user) throw new AppError('unauthenticated', 'Sign in required.')
      const data = await fn({ req, params: await params, userId: user?.id ?? null })
      if (data instanceof Response) return data
      return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (e) {
      if (e instanceof AppError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: STATUS[e.code] })
      console.error('[api]', e)
      return NextResponse.json({ error: { code: 'internal', message: 'Something went wrong.' } }, { status: 500 })
    }
  }
}
