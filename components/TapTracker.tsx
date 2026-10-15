'use client'

import { useEffect } from 'react'

/** Counts which detail a recipient taps (anonymously: the server keeps only the kind of detail). */
export function TapTracker({ token }: { token: string }) {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const a = (e.target as HTMLElement | null)?.closest<HTMLElement>('a[data-field-id]')
      if (!a) return
      const body = new Blob([JSON.stringify({ fieldId: a.dataset.fieldId })], { type: 'application/json' })
      try { navigator.sendBeacon(`/api/v1/public/shares/${encodeURIComponent(token)}/tap`, body) } catch { /* analytics never blocks the tap */ }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [token])
  return null
}
