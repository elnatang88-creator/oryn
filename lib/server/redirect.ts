import 'server-only'

/**
 * Redirect with a relative Location. Behind a reverse proxy the request URL a route handler sees is the
 * internal address (e.g. http://0.0.0.0:3000), so absolute redirects built from it send people nowhere.
 * Browsers resolve a relative Location against the address they actually used.
 */
export function relativeRedirect(path: string, status: 303 | 307 = 303) {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('relativeRedirect expects an absolute path on this site')
  return new Response(null, { status, headers: { Location: path, 'Cache-Control': 'private, no-store' } })
}
