'use client'

import { useRef, useState, type ReactNode, type PointerEvent } from 'react'

/**
 * Holds a card up to the light: move to tilt it, and (when a back is given) tap the card to flip it.
 * Without JavaScript the card simply renders flat — nothing is lost.
 */
export function CardStage({ front, back, startFlipped = false, flipLabel, showFlipButton = true, rise = false }: {
  front: ReactNode; back?: ReactNode; startFlipped?: boolean; flipLabel?: string; showFlipButton?: boolean; rise?: boolean
}) {
  const [flipped, setFlipped] = useState(startFlipped)
  const tilt = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  function move(e: PointerEvent<HTMLDivElement>) {
    const el = tilt.current
    if (!el || e.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = el.getBoundingClientRect()
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    el.style.transform = `rotateX(${(0.5 - py) * 16}deg) rotateY(${(px - 0.5) * 20}deg)`
    el.style.setProperty('--mx', `${px * 100}%`); el.style.setProperty('--my', `${py * 100}%`)
    el.style.setProperty('--hx', String(Math.round(px * 360))); el.style.setProperty('--foil-pos', `${Math.round(px * 100)}%`)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { el.style.transform = '' }, 1800)
  }
  const flip = () => back && setFlipped((f) => !f)
  return (
    <div className={`lc-stage ${rise ? 'lc-rise' : ''}`} onPointerMove={move} onPointerLeave={() => { if (tilt.current) tilt.current.style.transform = '' }}>
      <div className="lc-perspective">
        <div className="lc-tilt" ref={tilt}>
          <div
            className={`lc-flipper ${flipped ? 'is-flipped' : ''} ${back ? 'cursor-pointer' : ''}`}
            onClick={flip}
            {...(back ? { role: 'button', tabIndex: 0, 'aria-label': flipped ? 'Card back. Tap to show the front' : 'Card front. Tap to show the back', 'aria-pressed': flipped, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip() } } } : {})}
            data-testid="card-flipper" data-flipped={flipped}
          >
            <div className="lc-side">{front}</div>
            {back && <div className="lc-side lc-side-back">{back}</div>}
          </div>
        </div>
      </div>
      {back && showFlipButton && (
        <button type="button" className="btn mx-auto mt-4 flex min-h-[44px] rounded-xl bg-white/10 px-4 text-sm text-white hover:bg-white/15" onClick={flip} data-testid="flip-card">
          {flipLabel ?? (flipped ? 'Show the front' : 'Show the back')}
        </button>
      )}
    </div>
  )
}
