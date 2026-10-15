'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Re-renders the server page every few seconds while it is visible, so new views appear on their own. */
export function LiveRefresh({ every = 10000 }: { every?: number }) {
  const router = useRouter()
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) router.refresh() }, every)
    return () => clearInterval(t)
  }, [router, every])
  return null
}
