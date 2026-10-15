'use client'

import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react'
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
    if (drag.current?.active) return // a drag is a turn, not a tap
    const now = Date.now()
    const p = lastTap.current
    if (p && now - p.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 30) { lastTap.current = null; flip() }
    else lastTap.current = { t: now, x: e.clientX, y: e.clientY }
  }
  const light = (el: HTMLDivElement, px: number, py: number) => {
    el.style.setProperty('--mx', `${px * 100}%`); el.style.setProperty('--my', `${py * 100}%`); el.style.setProperty('--gx', px.toFixed(3))
    el.style.setProperty('--hx', String(Math.round(px * 360))); el.style.setProperty('--foil-pos', `${Math.round(px * 100)}%`)
  }
  const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Pointer devices: tilt toward the cursor. Touch: drag to turn the card in your hand (up to ±28°), spring back on release.
  const drag = useRef<{ x: number; y: number; active: boolean } | null>(null)
  function move(e: PointerEvent<HTMLDivElement>) {
    const el = tilt.current
    if (!el || reduced()) return
    const r = el.getBoundingClientRect()
    if (e.pointerType === 'touch') {
      const d = drag.current
      if (!d) return
      const dx = e.clientX - d.x, dy = e.clientY - d.y
      if (!d.active && Math.hypot(dx, dy) < 8) return
      d.active = true
      const ry = Math.max(-28, Math.min(28, dx / 4)), rx = Math.max(-16, Math.min(16, -dy / 6))
      el.style.transition = 'none'
      el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`
      light(el, 0.5 + ry / 56, 0.5 - rx / 32)
      return
    }
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    el.style.transform = `rotateX(${(0.5 - py) * 10}deg) rotateY(${(px - 0.5) * 14}deg)`
    light(el, px, py)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { el.style.transform = '' }, 1600)
  }
  function down(e: PointerEvent<HTMLDivElement>) { if (e.pointerType === 'touch') drag.current = { x: e.clientX, y: e.clientY, active: false } }
  function release() {
    const el = tilt.current
    const d = drag.current
    drag.current = null
    if (!el) return
    el.style.transition = ''
    el.style.transform = ''
    if (d?.active) { lastTap.current = null }
  }
  // Phones: the card answers the way you hold it (device motion). iOS asks permission on the first touch; if refused, nothing changes.
  const motionAsked = useRef(false)
  useEffect(() => {
    const el = tilt.current
    if (!el || reduced() || typeof DeviceOrientationEvent === 'undefined') return
    let raf = 0
    const on = (ev: DeviceOrientationEvent) => {
      if (drag.current?.active || ev.gamma == null || ev.beta == null) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const g = Math.max(-30, Math.min(30, ev.gamma!)), b = Math.max(-30, Math.min(30, ev.beta! - 40))
        el.style.transform = `rotateY(${g * 0.5}deg) rotateX(${-b * 0.35}deg)`
        light(el, 0.5 + g / 60, 0.5 + b / 60)
      })
    }
    const start = () => window.addEventListener('deviceorientation', on)
    const api = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> }
    if (typeof api.requestPermission !== 'function') start()
    else {
      const ask = () => { if (motionAsked.current) return; motionAsked.current = true; api.requestPermission!().then((r) => { if (r === 'granted') start() }).catch(() => {}) }
      el.addEventListener('pointerdown', ask, { once: true })
    }
    return () => { window.removeEventListener('deviceorientation', on); cancelAnimationFrame(raf) }
  }, [])
  return (
    <div className={`lc-stage ${tone === 'light' ? 'lc-stage-light' : ''} ${rise ? 'lc-reveal' : ''} ${className}`} onPointerMove={move} onPointerDown={down} onPointerUp={release} onPointerCancel={release} onPointerLeave={() => { if (tilt.current && !drag.current) tilt.current.style.transform = '' }}>
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
