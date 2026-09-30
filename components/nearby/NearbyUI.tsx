'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, Eye, EyeOff, Loader2, MapPin, Radar, UserPlus, WifiOff } from 'lucide-react'
import { Sheet } from '../Sheet'
import { CardFace, BrandBack } from '../LuxuryCard'
import { CardStage } from '../CardStage'
import { INDUSTRY_LABEL } from '@/lib/industries'
import type { Card, Incoming, Person, Visibility } from './useNearby'
import { useNearby } from './useNearby'

const VIS_SHORT: Record<Visibility, string> = { everyone: 'Everyone', connections: 'Connections', event: 'Event only', off: 'Invisible' }

export const VIS_COPY: Record<Visibility, { label: string; body: string }> = {
  everyone: { label: 'Everyone nearby', body: 'ORYN members close to you can see your card face and ask to connect.' },
  connections: { label: 'My connections', body: 'Only people already in your People see you nearby.' },
  event: { label: 'Event only', body: 'Only people at the same live event see you.' },
  off: { label: 'Invisible', body: 'Nobody can find you. You can still present your card or send a link.' },
}

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]).join('').toUpperCase() || '·'

function Avatar({ name, demo }: { name: string; demo?: boolean }) {
  return (
    <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#d8b56a] to-[#8a6a2f] text-sm font-bold text-navy-900">
      {initials(name)}
      {demo && <span className="absolute -bottom-1 rounded-full bg-white px-1.5 text-[9px] font-bold uppercase tracking-wide text-ink-muted shadow">demo</span>}
    </span>
  )
}

function CardPreview({ card, testId }: { card: Card; testId?: string }) {
  // Other people's cards never show their QR here: the back is always the ORYN mark.
  return (
    <div className="mx-auto w-full max-w-[340px]" data-testid={testId}>
      <CardStage rise showFlipButton={false}
        front={<CardFace design={card.design} identity={{ displayName: card.displayName, headline: card.headline, company: card.company, avatarUrl: card.avatarUrl }} />}
        back={<BrandBack design={card.design} name={card.displayName} />} />
    </div>
  )
}

export function VisibilitySheet({ open, onClose, value, onPick, hasEvents }: { open: boolean; onClose: () => void; value: Visibility; onPick: (v: Visibility) => void; hasEvents: boolean }) {
  return (
    <Sheet open={open} onClose={onClose} title="Who can find you nearby" testId="visibility-sheet">
      <div className="space-y-2" role="radiogroup" aria-label="Nearby visibility">
        {(['everyone', 'connections', 'event', 'off'] as Visibility[]).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} disabled={v === 'event' && !hasEvents}
            onClick={() => { onPick(v); onClose() }} data-testid={`visibility-${v}`}
            className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-start disabled:opacity-40 ${value === v ? 'border-electric bg-soft-50 ring-2 ring-electric/20' : 'border-soft-200'}`}>
            {v === 'off' ? <EyeOff className="mt-0.5 h-5 w-5 text-ink-muted" aria-hidden="true" /> : <Eye className="mt-0.5 h-5 w-5 text-electric" aria-hidden="true" />}
            <span><span className="block font-semibold">{VIS_COPY[v].label}</span><span className="block text-sm text-ink-muted">{v === 'event' && !hasEvents ? 'You’re not part of a live event right now.' : VIS_COPY[v].body}</span></span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-muted">Your exact location never leaves your phone. It’s turned into a rough area (about 150 m) first, and forgotten two minutes after you close this screen.</p>
    </Sheet>
  )
}

/** "[Name] would like to connect." Accept / Not now. Opens by itself when a request arrives. */
export function IncomingSheet({ incoming, onRespond }: { incoming: Incoming[]; onRespond: (id: string, accept: boolean) => Promise<unknown> }) {
  const [dismissed, setDismissed] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const req = incoming.find((r) => !dismissed.includes(r.id))
  if (!req) return null
  const act = async (accept: boolean) => {
    setBusy(true)
    try { await onRespond(req.id, accept) } finally { setBusy(false); setDismissed((d) => [...d, req.id]) }
  }
  return (
    <Sheet open onClose={() => setDismissed((d) => [...d, req.id])} title={`${req.name} would like to connect`} testId="incoming-request">
      <CardPreview card={req.card} />
      <p className="mt-3 text-center text-sm text-ink-muted">{[req.headline, req.industry ? INDUSTRY_LABEL[req.industry] : null].filter(Boolean).join(' · ')}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" disabled={busy} onClick={() => act(false)} className="btn-more" data-testid="incoming-not-now">Not now</button>
        <button type="button" disabled={busy} onClick={() => act(true)} className="btn-share" data-testid="incoming-accept">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" aria-hidden="true" />} Accept</button>
      </div>
      <p className="mt-3 text-center text-xs text-ink-muted">If you accept, you exchange what each of your cards allows. “Not now” is private — they’re never told.</p>
    </Sheet>
  )
}

function ConnectedToast({ name, connectionId, onClose }: { name: string; connectionId: string | null; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 6000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-[55] mx-auto max-w-sm animate-rise rounded-2xl bg-white p-4 text-ink shadow-2xl lg:bottom-8" role="status" data-testid="connected-toast">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-signal-ok"><Check className="h-5 w-5" /></span>
        <p className="flex-1 font-semibold">You and <bdi>{name}</bdi> are connected</p>
      </div>
      {connectionId && <Link href={`/connections/${connectionId}`} className="btn-share mt-3 w-full" data-testid="open-in-people">Open in People</Link>}
    </div>
  )
}

/** Small strip on the Share screen: shows whether you're visible, keeps presence alive, and surfaces requests. */
export function NearbyDock({ initialVisibility }: { initialVisibility: Visibility }) {
  const n = useNearby({ initialVisibility, promptForLocation: false, pollMs: 2000 })
  const toast = useAcceptedToast(n.data?.outgoing)
  const visible = n.presence === 'visible'
  return (
    <>
      <Link href="/share/nearby" className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-soft-100 hover:bg-white/15" data-testid="nearby-pill">
        <span className={`h-2 w-2 rounded-full ${visible ? 'animate-pulse bg-emerald-400' : 'bg-soft-300/60'}`} aria-hidden="true" />
        {n.visibility === 'off' ? 'Invisible nearby' : visible ? `Visible nearby · ${VIS_SHORT[n.visibility]}` : 'Open Nearby to become visible'}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
      <IncomingSheet incoming={n.data?.incoming ?? []} onRespond={n.respond} />
      {toast.node}
    </>
  )
}

function useAcceptedToast(outgoing: { id: string; name: string; status: string; connectionId: string | null }[] | undefined) {
  const [seen, setSeen] = useState<string[] | null>(null)
  const [show, setShow] = useState<{ name: string; connectionId: string | null } | null>(null)
  useEffect(() => {
    if (!outgoing) return // not loaded yet: don't treat older acceptances as new
    const accepted = outgoing.filter((o) => o.status === 'accepted')
    if (seen === null) { setSeen(accepted.map((o) => o.id)); return }
    const fresh = accepted.find((o) => !seen.includes(o.id))
    if (fresh) { setShow({ name: fresh.name, connectionId: fresh.connectionId }); setSeen((s) => [...(s ?? []), fresh.id]) }
  }, [outgoing, seen])
  return { node: show ? <ConnectedToast name={show.name} connectionId={show.connectionId} onClose={() => setShow(null)} /> : null, show: (name: string, connectionId: string | null) => setShow({ name, connectionId }) }
}

export function NearbyScreen({ initialVisibility, events, presentHref }: { initialVisibility: Visibility; events: { id: string; name: string }[]; presentHref: string }) {
  const n = useNearby({ initialVisibility, promptForLocation: true, pollMs: 2000 })
  const [visOpen, setVisOpen] = useState(false)
  const [person, setPerson] = useState<Person | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const toast = useAcceptedToast(n.data?.outgoing)
  const people = n.data?.people ?? []
  const live = people.find((p) => p.handle === person?.handle) ?? person

  async function connect(p: Person) {
    setPending(p.handle); setErr(null)
    try {
      const r = await n.connect(p.handle)
      if (r.status === 'connected') { toast.show(p.name, r.connectionId ?? null); setPerson(null) }
    } catch (e) { setErr((e as Error).message) } finally { setPending(null) }
  }

  const header = (
    <div className="flex items-center justify-between gap-2">
      <div>
        <h1 className="text-2xl font-bold">Nearby</h1>
        <p className="text-sm text-soft-300">ORYN members around you who chose to be found</p>
      </div>
      <button type="button" onClick={() => setVisOpen(true)} className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-semibold" data-testid="visibility-button">
        <span className={`h-2 w-2 rounded-full ${n.presence === 'visible' ? 'animate-pulse bg-emerald-400' : 'bg-soft-300/60'}`} aria-hidden="true" />
        <span className="whitespace-nowrap">{n.visibility === 'off' ? 'Invisible' : `${n.presence === 'visible' ? 'Visible' : 'Not visible'} · ${VIS_SHORT[n.visibility]}`}</span>
      </button>
    </div>
  )

  let body: React.ReactNode
  if (n.visibility === 'off') {
    body = (
      <div className="rounded-3xl bg-white/5 p-6 text-center" data-testid="nearby-off">
        <EyeOff className="mx-auto h-8 w-8 text-soft-300" aria-hidden="true" />
        <p className="mt-3 text-lg font-bold">You’re invisible</p>
        <p className="mt-1 text-sm text-soft-200">To see who’s around, let them see you too. You choose who, and it lasts only while ORYN is open.</p>
        <button type="button" onClick={() => setVisOpen(true)} className="btn-share mt-5 w-full" data-testid="become-visible">Become discoverable</button>
      </div>
    )
  } else if (n.presence === 'needs_event' || (n.visibility === 'event' && !n.eventId)) {
    body = (
      <div className="rounded-3xl bg-white/5 p-6" data-testid="nearby-needs-event">
        <p className="font-bold">Which event are you at?</p>
        {events.length ? (
          <div className="mt-3 space-y-2">{events.map((e) => <button key={e.id} type="button" onClick={() => n.setEventId(e.id)} className="btn w-full justify-between bg-white/10 text-white">{e.name}<ChevronRight className="h-4 w-4" /></button>)}</div>
        ) : <p className="mt-2 text-sm text-soft-200">You’re not part of a live event right now. Choose “Everyone nearby” or “My connections” instead.</p>}
      </div>
    )
  } else if (n.presence === 'needs_location' && (n.loc === 'denied' || n.loc === 'unavailable')) {
    body = (
      <div className="rounded-3xl bg-white/5 p-6" data-testid="nearby-location-denied">
        <MapPin className="h-7 w-7 text-soft-300" aria-hidden="true" />
        <p className="mt-2 text-lg font-bold">{n.loc === 'denied' ? 'Location is off for ORYN' : 'Your phone couldn’t find its location'}</p>
        <p className="mt-1 text-sm text-soft-200">Nearby needs a rough idea of where you are to find people next to you. {n.loc === 'denied' ? 'You can allow it in your browser’s site settings.' : 'Try again in a moment.'}</p>
        {events.length > 0 && <button type="button" onClick={() => n.setEventId(events[0].id)} className="btn mt-4 w-full bg-white/10 text-white">Use {events[0].name} instead</button>}
        {n.loc !== 'denied' && <button type="button" onClick={n.locate} className="btn mt-2 w-full bg-white/10 text-white">Try again</button>}
        <Link href={presentHref} className="btn-share mt-2 w-full">Present my card instead</Link>
      </div>
    )
  } else if (n.presence === 'needs_location') {
    body = (
      <div className="rounded-3xl bg-white/5 p-6 text-center" data-testid="nearby-needs-location">
        <MapPin className="mx-auto h-8 w-8 text-electric-300" aria-hidden="true" />
        <p className="mt-3 text-lg font-bold">{n.loc === 'locating' ? 'Finding where you are…' : 'Allow location to see who’s here'}</p>
        <p className="mt-1 text-sm text-soft-200">Your phone turns it into a rough area first. ORYN never receives your exact position.</p>
        {n.loc !== 'locating' && <button type="button" onClick={n.locate} className="btn-share mt-5 w-full" data-testid="allow-location">Allow location</button>}
      </div>
    )
  } else if (n.presence === 'no_card') {
    body = <div className="rounded-3xl bg-white/5 p-6 text-center"><p className="font-bold">Create your card first</p><Link href="/capsules/new" className="btn-share mt-4 w-full">Create my card</Link></div>
  } else if (!n.data || n.presence === 'idle') {
    body = (
      <ul className="space-y-3" aria-busy="true" data-testid="nearby-loading">
        {[0, 1, 2].map((i) => <li key={i} className="flex animate-pulse items-center gap-3 rounded-2xl bg-white/5 p-3"><span className="h-12 w-12 rounded-full bg-white/10" /><span className="h-4 flex-1 rounded bg-white/10" /></li>)}
      </ul>
    )
  } else if (people.length === 0) {
    body = (
      <div className="rounded-3xl bg-white/5 p-6 text-center" data-testid="nearby-empty">
        <Radar className="mx-auto h-8 w-8 animate-pulse text-electric-300" aria-hidden="true" />
        <p className="mt-3 text-lg font-bold">No one nearby yet</p>
        <p className="mt-1 text-sm text-soft-200">You’re visible. When someone next to you opens ORYN’s Share, they appear here. Not on ORYN? Present your card — they don’t need the app.</p>
        <Link href={presentHref} className="btn mt-5 w-full bg-white text-navy-900">Present my card</Link>
      </div>
    )
  } else {
    body = (
      <>
        <p className="mb-3 text-sm font-semibold text-soft-200" data-testid="nearby-count">{people.length} {people.length === 1 ? 'person' : 'people'} nearby</p>
        <ul className="space-y-2">
          {people.map((p, i) => (
            <li key={p.handle} className="animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center gap-3 rounded-2xl bg-white/[0.07] p-3" data-testid="nearby-person">
                <button type="button" onClick={() => setPerson(p)} className="flex min-w-0 flex-1 items-center gap-3 text-start" data-testid="nearby-person-open">
                  <Avatar name={p.name} demo={p.isDemo} />
                  <span className="min-w-0">
                    <span dir="auto" className="block truncate font-semibold">{p.name}</span>
                    <span dir="auto" className="block truncate text-sm text-soft-200">{[p.headline, p.card.company].filter(Boolean).join(' · ') || 'ORYN member'}</span>
                    <span className="block truncate text-xs text-soft-300">{p.proximity}{p.industry ? ` · ${INDUSTRY_LABEL[p.industry]}` : ''}</span>
                  </span>
                </button>
                <RelationButton p={p} busy={pending === p.handle} onConnect={() => connect(p)} />
              </div>
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <div className="entry-stage -mx-4 -my-6 min-h-[calc(100dvh-3.5rem)] overflow-x-hidden px-4 pb-10 pt-5 text-white sm:-mx-6 sm:px-6 lg:-my-10 lg:rounded-3xl lg:py-10">
      <div className="mx-auto max-w-md">
        {header}
        {!n.online && <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-signal-warn" role="status"><WifiOff className="h-4 w-4" aria-hidden="true" /> You’re offline. Nearby comes back when you have signal.</p>}
        {n.online && n.error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-signal-stop" role="alert" data-testid="nearby-error">{n.error}</p>}
        {err && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-signal-stop" role="alert">{err}</p>}
        <div className="mt-6">{body}</div>
        <p className="mt-6 text-center text-xs text-soft-300">Nearby uses a rough area or a shared event — not Bluetooth or NFC. You’re shown only while this screen or Share is open.</p>
      </div>

      <VisibilitySheet open={visOpen} onClose={() => setVisOpen(false)} value={n.visibility} onPick={n.changeVisibility} hasEvents={events.length > 0} />
      <Sheet open={!!live} onClose={() => setPerson(null)} title={live?.name ?? ''} testId="person-sheet">
        {live && (
          <>
            <CardPreview card={live.card} testId="person-card" />
            <p className="mt-3 text-center text-sm text-ink-muted">{[live.headline, live.industry ? INDUSTRY_LABEL[live.industry] : null, live.proximity].filter(Boolean).join(' · ')}</p>
            {live.isDemo && <p className="mt-2 rounded-xl bg-soft-100 px-3 py-2 text-center text-xs font-semibold text-navy-900">Demo member · fictional person for trying Nearby</p>}
            <div className="mt-4 space-y-2">
              {live.relation === 'connected' && live.connectionId
                ? <Link href={`/connections/${live.connectionId}`} className="btn-share w-full">Open in People</Link>
                : live.relation === 'requested'
                  ? <p className="btn-more w-full cursor-default" data-testid="person-requested">Request sent · waiting</p>
                  : <button type="button" onClick={() => connect(live)} disabled={pending === live.handle} className="btn-share w-full" data-testid="person-connect">{pending === live.handle ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" aria-hidden="true" />} {live.relation === 'requested_you' ? 'Accept and connect' : 'Connect'}</button>}
              <p className="text-center text-xs text-ink-muted">Tap the card to see its back. Details are exchanged only when you both agree.</p>
            </div>
          </>
        )}
      </Sheet>
      <IncomingSheet incoming={n.data?.incoming ?? []} onRespond={n.respond} />
      {toast.node}
    </div>
  )
}

function RelationButton({ p, busy, onConnect }: { p: Person; busy: boolean; onConnect: () => void }) {
  if (p.relation === 'connected') return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-3 py-2 text-xs font-semibold text-emerald-300"><Check className="h-4 w-4" aria-hidden="true" /> Connected</span>
  if (p.relation === 'requested') return <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-soft-200" data-testid="nearby-requested">Waiting…</span>
  return (
    <button type="button" onClick={onConnect} disabled={busy} className="inline-flex min-h-[40px] items-center gap-1 rounded-full bg-electric px-4 text-sm font-semibold text-white disabled:opacity-60" data-testid="nearby-connect">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />} {p.relation === 'requested_you' ? 'Accept' : 'Connect'}
    </button>
  )
}
