'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { encodeCell } from '@/lib/geocell'
import type { CardDesign } from '@/lib/card-design'

export type Visibility = 'off' | 'everyone' | 'connections' | 'event'
export interface Card { displayName: string; headline: string; company: string | null; avatarUrl: string | null; design: CardDesign }
export interface Person { handle: string; name: string; headline: string; industry: string | null; proximity: string; isDemo: boolean; card: Card; relation: 'none' | 'connected' | 'requested' | 'requested_you'; connectionId: string | null }
export interface Incoming { id: string; name: string; headline: string; industry: string | null; createdAt: string; card: Card }
export interface Outgoing { id: string; name: string; status: 'accepted' | 'waiting'; connectionId: string | null }
export interface NearbyData { visibility: Visibility; present: boolean; eventId: string | null; people: Person[]; incoming: Incoming[]; outgoing: Outgoing[] }
export type LocationState = 'unknown' | 'prompt' | 'locating' | 'ok' | 'denied' | 'unavailable'

const HEARTBEAT_MS = 30_000
const EVENT_KEY = 'oryn.nearby.event'

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j?.error?.message ?? 'Something went wrong.')
  return j.data as T
}

/**
 * Presence + polling for Nearby. Location is read on the phone and reduced to a coarse area cell before it is
 * sent; the server never sees coordinates. Near-realtime today = polling every `pollMs` (production realtime
 * transport is an integration item — see docs/NEARBY_AND_WALLET.md).
 */
export function useNearby({ initialVisibility, promptForLocation, pollMs = 2500 }: { initialVisibility: Visibility; promptForLocation: boolean; pollMs?: number }) {
  const [visibility, setVis] = useState<Visibility>(initialVisibility)
  const [data, setData] = useState<NearbyData | null>(null)
  const [loc, setLoc] = useState<LocationState>('unknown')
  const [cell, setCell] = useState<string | null>(null)
  const [eventId, setEventIdState] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [presence, setPresence] = useState<'idle' | 'visible' | 'needs_location' | 'needs_event' | 'no_card' | 'off'>('idle')
  const alive = useRef(true)
  const hasFix = useRef(false)

  useEffect(() => {
    try { setEventIdState(localStorage.getItem(EVENT_KEY)) } catch { /* storage blocked */ }
    const on = () => setOnline(navigator.onLine)
    on()
    window.addEventListener('online', on); window.addEventListener('offline', on)
    return () => { alive.current = false; window.removeEventListener('online', on); window.removeEventListener('offline', on) }
  }, [])

  const setEventId = useCallback((id: string | null) => {
    setEventIdState(id)
    try { if (id) localStorage.setItem(EVENT_KEY, id); else localStorage.removeItem(EVENT_KEY) } catch { /* storage blocked */ }
  }, [])

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) { setLoc('unavailable'); return }
    setLoc('locating')
    navigator.geolocation.getCurrentPosition(
      (p) => { if (!alive.current) return; hasFix.current = true; setCell(encodeCell(p.coords.latitude, p.coords.longitude)); setLoc('ok') },
      (e) => { if (!alive.current) return; setLoc(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable') },
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 12_000 },
    )
  }, [])

  // Only ask for location after the person turned Nearby on. On the Share screen we never prompt: we only use
  // a permission they already granted.
  useEffect(() => {
    if (visibility === 'off' || visibility === 'event') return
    let cancelled = false
    ;(async () => {
      let state: PermissionState | 'unknown' = 'unknown'
      try { state = (await navigator.permissions.query({ name: 'geolocation' as PermissionName })).state } catch { /* Safari < 16 */ }
      if (cancelled) return
      if (state === 'granted' || (promptForLocation && state !== 'denied')) locate()
      else setLoc(state === 'denied' ? 'denied' : 'prompt')
    })()
    const t = setInterval(() => { if (document.visibilityState === 'visible' && hasFix.current) locate() }, HEARTBEAT_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [visibility, promptForLocation, locate])

  // Heartbeat: stay discoverable while this screen is open; leave when it closes.
  useEffect(() => {
    if (visibility === 'off') { setPresence('off'); return }
    const sendCell = visibility === 'event' ? null : cell
    if (!sendCell && !eventId) { setPresence(visibility === 'event' ? 'needs_event' : 'needs_location'); return }
    let stop = false
    const beat = async () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      try {
        const r = await post<{ visible: boolean; reason?: 'needs_location' | 'needs_event' | 'no_card' | 'off' }>('/api/v1/nearby/presence', { cell: sendCell, eventId })
        if (!stop) setPresence(r.visible ? 'visible' : r.reason ?? 'off')
      } catch (e) { if (!stop) setError((e as Error).message) }
    }
    beat()
    const t = setInterval(beat, HEARTBEAT_MS)
    const leave = () => { fetch('/api/v1/nearby/leave', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: '{}' }).catch(() => {}) }
    window.addEventListener('pagehide', leave)
    return () => { stop = true; clearInterval(t); window.removeEventListener('pagehide', leave) }
  }, [visibility, cell, eventId])

  const refresh = useCallback(async () => {
    if (!navigator.onLine) return
    try {
      const r = await fetch('/api/v1/nearby', { cache: 'no-store' })
      if (!r.ok) throw new Error('Couldn’t reach ORYN.')
      const j = await r.json()
      if (alive.current) { setData(j.data); setError(null) }
    } catch (e) { if (alive.current) setError((e as Error).message) }
  }, [])

  // While I'm waiting on an answer, check every second so "connected" lands immediately (until realtime push exists).
  const [hurryUntil, setHurryUntil] = useState(0)
  const waiting = !!data?.outgoing.some((o) => o.status === 'waiting') && Date.now() < hurryUntil
  const every = waiting ? 1000 : pollMs
  useEffect(() => {
    refresh()
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, every)
    return () => clearInterval(t)
  }, [refresh, every])

  const changeVisibility = useCallback(async (v: Visibility) => {
    setVis(v)
    try { await post('/api/v1/nearby/visibility', { visibility: v }); refresh() } catch (e) { setError((e as Error).message) }
  }, [refresh])

  const connect = useCallback(async (handle: string) => {
    const r = await post<{ status: 'requested' | 'connected'; connectionId?: string }>('/api/v1/nearby/connect', { handle })
    setHurryUntil(Date.now() + 60_000)
    refresh()
    return r
  }, [refresh])

  const respond = useCallback(async (requestId: string, accept: boolean) => {
    const r = await post<{ connectionId: string | null }>('/api/v1/nearby/respond', { requestId, accept })
    refresh()
    return r
  }, [refresh])

  return { visibility, data, loc, locate, eventId, setEventId, online, error, presence, changeVisibility, connect, respond, refresh }
}
