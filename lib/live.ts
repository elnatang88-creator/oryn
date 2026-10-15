'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * One EventSource per page for the member's live stream (/api/v1/stream). Reconnects with backoff; when the
 * browser can't hold a stream (or it drops), callers keep a slow poll as the fallback.
 */
export function useLive(topics: string[], opts: { event?: string | null; onEvent: (name: string, data: unknown) => void }) {
  const [connected, setConnected] = useState(false)
  const handler = useRef(opts.onEvent)
  handler.current = opts.onEvent
  const key = topics.join(',') + '|' + (opts.event ?? '')
  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    let es: EventSource | null = null, attempt = 0, timer: ReturnType<typeof setTimeout> | undefined, stopped = false
    const names = key.split('|')[0].split(',').concat(['checkin'])
    const open = () => {
      if (stopped) return
      const url = `/api/v1/stream?topics=${encodeURIComponent(key.split('|')[0])}${opts.event ? `&event=${encodeURIComponent(opts.event)}` : ''}`
      es = new EventSource(url)
      es.onopen = () => { attempt = 0; setConnected(true) }
      for (const n of names) es.addEventListener(n, (e) => { try { handler.current(n, JSON.parse((e as MessageEvent).data)) } catch { /* ignore */ } })
      es.onerror = () => {
        setConnected(false); es?.close(); es = null
        attempt += 1
        timer = setTimeout(open, Math.min(30_000, 1000 * 2 ** attempt))
      }
    }
    open()
    const vis = () => { if (document.visibilityState === 'visible' && !es) { attempt = 0; open() } }
    document.addEventListener('visibilitychange', vis)
    return () => { stopped = true; clearTimeout(timer); es?.close(); document.removeEventListener('visibilitychange', vis) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return connected
}
