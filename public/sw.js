/*
 * ORYN service worker — deliberately small.
 * Goal: Present Card still opens with bad or no reception (conference halls). It keeps:
 *   - static build assets and fonts (cache-first; their names are content-hashed),
 *   - the LAST Present screen you opened (network-first, falls back to the copy on this device).
 * It never caches API responses or other pages, never queues writes, and is cleared on sign-out.
 */
const STATIC = 'oryn-static-v1'
const PRESENT = 'oryn-present-v1'
const LAST = '/__oryn/present-last'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (![STATIC, PRESENT].includes(k)) await caches.delete(k)
  await self.clients.claim()
})()))
self.addEventListener('message', (e) => {
  if (e.data === 'oryn:clear') e.waitUntil(Promise.all([caches.delete(PRESENT)]))
})

const isStatic = (u) => u.pathname.startsWith('/_next/static/') || u.pathname.startsWith('/fonts/') || u.pathname.startsWith('/brand/')
const isPresent = (u) => /^\/share\/[A-Za-z0-9_-]+\/present$/.test(u.pathname)
const wantsPresent = (u) => u.pathname === '/share/quick' && u.searchParams.get('then') === 'present'

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const u = new URL(req.url)
  if (u.origin !== self.location.origin) return
  if (isStatic(u)) {
    e.respondWith(caches.open(STATIC).then(async (c) => (await c.match(req)) || fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r })))
    return
  }
  if (req.mode === 'navigate' && (isPresent(u) || wantsPresent(u))) {
    e.respondWith((async () => {
      const c = await caches.open(PRESENT)
      try {
        const r = await fetch(req)
        if (r.ok && isPresent(new URL(r.url))) await c.put(LAST, r.clone())
        return r
      } catch {
        return (await c.match(LAST)) || Response.error()
      }
    })())
  }
})
