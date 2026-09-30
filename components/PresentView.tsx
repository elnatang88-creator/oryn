'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { QrCode, Share2, X } from 'lucide-react'
import { CardStage } from './CardStage'

/**
 * Present: the card fills the screen, nothing else competes. Keeps the screen awake where the browser supports
 * the Screen Wake Lock API (it can't raise brightness — no web API allows that).
 */
export function PresentView({ front, back, url, name, closeHref, qrHref }: { front: ReactNode; back: ReactNode; url: string; name: string; closeHref: string; qrHref: string }) {
  const [canShare, setCanShare] = useState(false)
  const [awake, setAwake] = useState<'on' | 'unsupported' | 'off'>('off')
  useEffect(() => {
    setCanShare(typeof navigator.share === 'function')
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    async function acquire() {
      if (!nav.wakeLock) return setAwake('unsupported')
      try { lock = await nav.wakeLock.request('screen'); setAwake('on') } catch { setAwake('off') }
    }
    acquire()
    const vis = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', vis)
    return () => { document.removeEventListener('visibilitychange', vis); lock?.release().catch(() => {}) }
  }, [])
  return (
    <div className="entry-stage fixed inset-0 z-50 flex flex-col text-white" data-testid="present-view">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <Link href={closeHref} className="grid h-11 w-11 place-items-center rounded-full bg-white/10" aria-label="Close" data-testid="present-close"><X className="h-5 w-5" /></Link>
        <span className="text-xs text-soft-300" aria-live="polite">{awake === 'on' ? 'Screen stays on' : ''}</span>
      </div>
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-[560px]"><CardStage rise showFlipButton={false} front={front} back={back} /></div>
      </div>
      <p className="text-center text-xs text-soft-300">Tap the card to turn it over</p>
      <div className="mx-auto mt-4 grid w-full max-w-sm grid-cols-2 gap-3 px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        {canShare
          ? <button type="button" onClick={() => navigator.share({ title: `${name} · ORYN card`, url }).catch(() => {})} className="btn min-h-[52px] rounded-2xl bg-white/10 text-white" data-testid="present-share"><Share2 className="h-5 w-5" aria-hidden="true" /> Send</button>
          : <Link href={closeHref} className="btn min-h-[52px] rounded-2xl bg-white/10 text-white"><Share2 className="h-5 w-5" aria-hidden="true" /> Other ways</Link>}
        <Link href={qrHref} className="btn min-h-[52px] rounded-2xl bg-white/10 text-white" data-testid="present-qr"><QrCode className="h-5 w-5" aria-hidden="true" /> QR</Link>
      </div>
    </div>
  )
}
