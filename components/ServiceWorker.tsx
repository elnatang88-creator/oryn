'use client'

import { useEffect } from 'react'

/** Registers the offline Present worker (production only) and clears its copy when signed out. */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return
    const signedOut = ['/signin', '/signup', '/welcome', '/'].includes(location.pathname)
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      if (signedOut) (reg.active ?? navigator.serviceWorker.controller)?.postMessage('oryn:clear')
    }).catch(() => {})
  }, [])
  return null
}
