'use client'

import { useRef, useState, type ReactNode, type PointerEvent } from 'react'
import { trackClient } from '@/lib/track-client'

const DOUBLE_TAP_MS = 320

/**
 * The card as a physical object. Double-tap (or double-click) flips it around the Y axis; Enter/Space and a
 * screen-reader button do the same. On a pointer device it tilts slightly toward the cursor.
 * Front and back share one size, so flipping never shifts the layout. Without JavaScript it renders flat.
 */
export function CardStage({ front, back, startFlipped = false, hint = true, rise = false, tone = 'dark', surface, className = '' }: {
  front: ReactNode; back?: ReactNode; startFlipped?: boolean; hint?: boolean; rise?: boolean; tone?: 'dark' | 'light'
  surface?: 'share' | 'present' | 'studio' | 'people' | 'nearby' | 'recipient' | 'first_run'; className?: string
}) {
  const [flipped, setFlipped] = useState(startFlipped)
  const tilt = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null)

  function flip() {
    if (!back) return
    setFlipped((f) => {
      if (surface) trackClient('card_flipped', { surface, side: f ? 'front' : 'back' })
      return !f
    })
    if ('vibrate' in navigator) try { navigator.vibrate?.(8) } catch { /* not allowed */ }
  }
  function onUp(e: PointerEvent<HTMLDivElement>) {
    const now = Date.now()
    const p = lastTap.current
    if (p && now - p.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 30) { lastTap.current = null; flip() }
    else lastTap.current = { t: now, x: e.clientX, y: e.clientY }
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const el = tilt.current
    if (!el || e.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = el.getBoundingClientRect()
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    el.style.transform = `rotateX(${(0.5 - py) * 10}deg) rotateY(${(px - 0.5) * 14}deg)`
    el.style.setProperty('--mx', `${px * 100}%`); el.style.setProperty('--my', `${py * 100}%`)
    el.style.setProperty('--hx', String(Math.round(px * 360))); el.style.setProperty('--foil-pos', `${Math.round(px * 100)}%`)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { el.style.transform = '' }, 1600)
  }
  return (
    <div className={`lc-stage ${tone === 'light' ? 'lc-stage-light' : ''} ${rise ? 'lc-rise' : ''} ${className}`} onPointerMove={move} onPointerLeave={() => { if (tilt.current) tilt.current.style.transform = '' }}>
      <div className="lc-perspective">
        <div className="lc-tilt" ref={tilt}>
          <div
            className={`lc-flipper ${flipped ? 'is-flipped' : ''}`}
            onPointerUp={back ? onUp : undefined}
            {...(back ? { tabIndex: 0, role: 'group', 'aria-roledescription': 'card', 'aria-label': flipped ? 'Card back' : 'Card front', onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip() } } } : {})}
            data-testid="card-flipper" data-flipped={flipped}
          >
            <div className="lc-side" aria-hidden={back ? flipped : undefined}>{front}</div>
            {back && <div className="lc-side lc-side-back" aria-hidden={!flipped}>{back}</div>}
          </div>
        </div>
      </div>
      {back && (
        <>
          <button type="button" className="sr-only" onClick={flip} data-testid="flip-card">{flipped ? 'Show the front of the card' : 'Show the back of the card'}</button>
          {hint && <p className={`mt-2 text-center text-xs ${tone === 'light' ? 'text-ink-muted' : 'text-soft-300'}`} aria-hidden="true">Double-tap to flip</p>}
        </>
      )}
    </div>
  )
}
