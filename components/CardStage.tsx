'use client'

import { useRef, useState, type ReactNode, type PointerEvent } from 'react'

/**
 * Holds a card up to the light: drag/move to tilt it, and (when a back is given) tap to flip.
 * Without JavaScript the card simply renders flat — nothing is lost.
 */
export function CardStage({ front, back, startFlipped = false, flipLabel }: { front: ReactNode; back?: ReactNode; startFlipped?: boolean; flipLabel?: string }) {
  const [flipped, setFlipped] = useState(startFlipped)
  const tilt = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  function move(e: PointerEvent<HTMLDivElement>) {
    const el = tilt.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = el.getBoundingClientRect()
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    el.style.transform = `rotateX(${(0.5 - py) * 16}deg) rotateY(${(px - 0.5) * 20}deg)`
    el.style.setProperty('--mx', `${px * 100}%`); el.style.setProperty('--my', `${py * 100}%`)
    el.style.setProperty('--hx', String(Math.round(px * 360))); el.style.setProperty('--foil-pos', `${Math.round(px * 100)}%`)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { el.style.transform = '' }, 1800)
  }
  return (
    <div className="lc-stage" onPointerMove={move} onPointerLeave={() => { if (tilt.current) tilt.current.style.transform = '' }}>
      <div className="lc-perspective">
        <div className="lc-tilt" ref={tilt}>
          <div className={`lc-flipper ${flipped ? 'is-flipped' : ''}`}>
            <div className="lc-side">{front}</div>
            {back && <div className="lc-side lc-side-back">{back}</div>}
          </div>
        </div>
      </div>
      {back && (
        <button type="button" className="btn mx-auto mt-4 flex min-h-[44px] rounded-xl bg-white/10 px-4 text-sm text-white hover:bg-white/15" onClick={() => setFlipped((f) => !f)} data-testid="flip-card">
          {flipLabel ?? (flipped ? 'Show the front' : 'Show the QR side')}
        </button>
      )}
    </div>
  )
}
