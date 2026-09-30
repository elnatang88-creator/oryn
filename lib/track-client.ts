'use client'

import type { ClientEvent } from './analytics-events'

let sid: string | null = null
function sessionId() {
  if (sid) return sid
  try {
    sid = sessionStorage.getItem('oryn.sid')
    if (!sid) { sid = crypto.randomUUID().replace(/-/g, '').slice(0, 24); sessionStorage.setItem('oryn.sid', sid) }
  } catch { sid = 'nostorage00' }
  return sid
}

/** Fire-and-forget in-app event. Props must be ids/enums (the server drops anything else). Never blocks the UI. */
export function trackClient(name: ClientEvent, props: Record<string, string | number | undefined> = {}) {
  try {
    fetch('/api/v1/events', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, props, sessionId: sessionId() }) }).catch(() => {})
  } catch { /* analytics never breaks the product */ }
}
