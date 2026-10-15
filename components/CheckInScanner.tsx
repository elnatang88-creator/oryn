'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Check, Loader2, Search, XCircle } from 'lucide-react'

type Result = { status: 'ok'; name: string; company: string } | { status: 'already'; name: string; at: string } | { status: 'not_found' } | { status: 'cancelled' | 'waitlisted'; name: string }

/**
 * Door scanner. Uses the browser's BarcodeDetector when it exists (Android Chrome), otherwise decodes frames
 * with jsQR. Every scan is confirmed by the server (atomic), so two phones can't both admit the same ticket.
 * Manual search is always there for a phone with no camera permission.
 */
export function CheckInScanner({ eventId }: { eventId: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const [cam, setCam] = useState<'idle' | 'on' | 'denied' | 'unavailable'>('idle')
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<{ r: Result; at: number } | null>(null)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<{ id: string; name: string; email: string; company: string; status: string; checked_in_at: string | null }[] | null>(null)
  const seen = useRef<Map<string, number>>(new Map())
  const [stats, setStats] = useState<{ checked_in: number; confirmed: number; last_hour: number } | null>(null)

  const beep = (ok: boolean) => {
    try { if ('vibrate' in navigator) navigator.vibrate?.(ok ? 40 : [60, 40, 60]) } catch { /* no haptics */ }
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination)
      o.frequency.value = ok ? 880 : 220; g.gain.value = 0.08; o.start(); o.stop(ctx.currentTime + (ok ? 0.12 : 0.3))
    } catch { /* no audio */ }
  }

  async function submit(ref: string, method: 'scan' | 'manual') {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/events/${eventId}/checkin`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ref, method }) })
      const j = await res.json()
      const r: Result = res.ok ? j.data : { status: 'not_found' }
      setLast({ r, at: Date.now() })
      beep(r.status === 'ok')
      refreshStats()
      if (found) search(q)
    } catch { setLast({ r: { status: 'not_found' }, at: Date.now() }) } finally { setBusy(false) }
  }

  async function refreshStats() {
    try { const res = await fetch(`/api/v1/events/${eventId}/checkin`, { cache: 'no-store' }); if (res.ok) setStats((await res.json()).data) } catch { /* offline */ }
  }
  async function search(term: string) {
    setQ(term)
    if (term.trim().length < 2) { setFound(null); return }
    try { const res = await fetch(`/api/v1/events/${eventId}/registrations?q=${encodeURIComponent(term)}`, { cache: 'no-store' }); if (res.ok) setFound((await res.json()).data) } catch { /* offline */ }
  }

  useEffect(() => { refreshStats(); const t = setInterval(refreshStats, 15000); return () => clearInterval(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cam !== 'on') return
    let stream: MediaStream | null = null, raf = 0, stop = false
    const el = video.current!
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        el.srcObject = stream; await el.play()
      } catch (e) { setCam((e as DOMException).name === 'NotAllowedError' ? 'denied' : 'unavailable'); return }
      const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector
      const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null
      const canvas = document.createElement('canvas')
      type Decoder = (d: Uint8ClampedArray, w: number, h: number) => { data: string } | null
      let jsQR: Decoder | null = null
      if (!detector) jsQR = (await import('jsqr')).default as unknown as Decoder
      const tick = async () => {
        if (stop) return
        if (el.readyState >= 2 && !busy) {
          let value: string | null = null
          try {
            if (detector) value = (await detector.detect(el))[0]?.rawValue ?? null
            else if (jsQR) {
              canvas.width = el.videoWidth; canvas.height = el.videoHeight
              const c = canvas.getContext('2d', { willReadFrequently: true })!
              c.drawImage(el, 0, 0)
              const img = c.getImageData(0, 0, canvas.width, canvas.height)
              value = jsQR(img.data, img.width, img.height)?.data ?? null
            }
          } catch { /* frame not ready */ }
          if (value && (Date.now() - (seen.current.get(value) ?? 0)) > 4000) { seen.current.set(value, Date.now()); await submit(value, 'scan') }
        }
        raf = window.setTimeout(tick, detector ? 150 : 250)
      }
      tick()
    })()
    return () => { stop = true; clearTimeout(raf); stream?.getTracks().forEach((t) => t.stop()) }
  }, [cam]) // eslint-disable-line react-hooks/exhaustive-deps

  const fresh = last && Date.now() - last.at < 60_000 ? last.r : null
  return (
    <div className="space-y-4" data-testid="checkin-scanner">
      {stats && (
        <dl className="grid grid-cols-3 gap-2 text-center">
          {([['Checked in', stats.checked_in], ['Registered', stats.confirmed], ['Last hour', stats.last_hour]] as const).map(([k, v]) => (
            <div key={k} className="card px-2 py-3"><dd className="text-2xl font-bold tabular-nums text-navy-900" data-testid={`stat-${k.toLowerCase().replace(/\W+/g, '-')}`}>{v}</dd><dt className="text-[11px] font-semibold text-ink-muted">{k}</dt></div>
          ))}
        </dl>
      )}
      <div className="relative overflow-hidden rounded-3xl bg-navy-950" style={{ aspectRatio: '4 / 3' }}>
        <video ref={video} className={`h-full w-full object-cover ${cam === 'on' ? '' : 'hidden'}`} muted playsInline />
        {cam !== 'on' && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
            {cam === 'idle' && <button type="button" onClick={() => setCam('on')} className="btn-share" data-testid="start-camera"><Camera className="h-5 w-5" aria-hidden="true" /> Start scanning</button>}
            {cam === 'denied' && <p className="text-sm"><CameraOff className="mx-auto mb-2 h-7 w-7" aria-hidden="true" />Camera is blocked for ORYN. Allow it in your browser’s site settings, or search by name below.</p>}
            {cam === 'unavailable' && <p className="text-sm"><CameraOff className="mx-auto mb-2 h-7 w-7" aria-hidden="true" />No camera available here. Search by name below.</p>}
          </div>
        )}
        {cam === 'on' && <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/60" aria-hidden="true" />}
      </div>
      <div aria-live="polite" className="min-h-[72px]">
        {busy && <p className="card flex items-center gap-2 px-4 py-4 text-ink-muted"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Checking…</p>}
        {!busy && fresh && <Verdict r={fresh} />}
      </div>
      <div className="card p-4">
        <label className="label" htmlFor="q"><Search className="mr-1 inline h-4 w-4" aria-hidden="true" /> Find by name, email or company</label>
        <input dir="auto" id="q" value={q} onChange={(e) => search(e.target.value)} className="input" placeholder="Type at least 2 characters" data-testid="checkin-search" />
        {found && (
          <ul className="mt-3 divide-y divide-soft-100">
            {found.length === 0 && <li className="py-3 text-sm text-ink-muted">No one matches.</li>}
            {found.slice(0, 20).map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1"><span dir="auto" className="block truncate font-semibold">{r.name}</span><span className="block truncate text-xs text-ink-muted">{[r.company, r.email].filter(Boolean).join(' · ')}</span></span>
                {r.checked_in_at ? <span className="chip-public">Checked in</span> : r.status !== 'confirmed' ? <span className="chip-muted capitalize">{r.status}</span>
                  : <button type="button" onClick={() => submit(r.id, 'manual')} disabled={busy} className="btn-share min-h-[40px] px-3 text-sm" data-testid="manual-checkin">Check in</button>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Verdict({ r }: { r: Result }) {
  if (r.status === 'ok') return <p className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-4 text-lg font-bold text-signal-ok" data-testid="verdict-ok"><Check className="h-7 w-7" aria-hidden="true" /><span>Welcome, <bdi>{r.name}</bdi>{r.company ? <span className="block text-sm font-medium text-ink-muted">{r.company}</span> : null}</span></p>
  if (r.status === 'already') return <p className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-4 text-lg font-bold text-signal-warn" data-testid="verdict-already"><XCircle className="h-7 w-7" aria-hidden="true" /><span>Already checked in — <bdi>{r.name}</bdi><span className="block text-sm font-medium">at {new Date(r.at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span></span></p>
  if (r.status === 'not_found') return <p className="flex items-center gap-3 rounded-2xl bg-red-50 px-4 py-4 text-lg font-bold text-signal-stop" data-testid="verdict-bad"><XCircle className="h-7 w-7" aria-hidden="true" /> Not a ticket for this event</p>
  return <p className="flex items-center gap-3 rounded-2xl bg-red-50 px-4 py-4 text-lg font-bold text-signal-stop" data-testid="verdict-bad"><XCircle className="h-7 w-7" aria-hidden="true" /><span><bdi>{r.name}</bdi> — {r.status === 'cancelled' ? 'registration cancelled' : 'on the waitlist, not confirmed'}</span></p>
}
