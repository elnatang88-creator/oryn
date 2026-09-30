'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, ChevronRight, Info, Loader2, MapPin, Radar, UserPlus, WifiOff } from 'lucide-react'
import { Sheet } from '../Sheet'
import { CardFace, BrandBack } from '../LuxuryCard'
import { CardStage } from '../CardStage'
import { INDUSTRY_LABEL } from '@/lib/industries'
import { trackClient } from '@/lib/track-client'
import type { Card, Incoming, Person, Visibility } from './useNearby'
import { useNearby } from './useNearby'

export const VIS_COPY: Record<Exclude<Visibility, 'off'>, { label: string; body: string }> = {
  everyone: { label: 'Everyone nearby', body: 'ORYN members around you can see your card and ask to connect.' },
  event: { label: 'Event attendees', body: 'Only people at the same live event.' },
  connections: { label: 'My connections', body: 'Only people already in your People.' },
}

const face = (c: Card) => ({ displayName: c.displayName, headline: c.headline, company: c.company, avatarUrl: c.avatarUrl })

function MiniCard({ card, className = 'w-[84px]' }: { card: Card; className?: string }) {
  return <span className={`block shrink-0 ${className}`} aria-hidden="true"><CardFace design={card.design} identity={face(card)} /></span>
}

function CardPreview({ card, testId }: { card: Card; testId?: string }) {
  // Before you're connected, the back shows only the ORYN mark — details are exchanged when you both agree.
  return (
    <div className="mx-auto w-full max-w-[320px]" data-testid={testId}>
      <CardStage rise surface="nearby" tone="light" front={<CardFace design={card.design} identity={face(card)} />} back={<BrandBack design={card.design} name={card.displayName} />} />
    </div>
  )
}

/** Who can find me — one clear choice. "Off" is the switch, not an option in this list. */
export function AudienceSheet({ open, onClose, value, onPick, hasEvents }: { open: boolean; onClose: () => void; value: Visibility; onPick: (v: Visibility) => void; hasEvents: boolean }) {
  return (
    <Sheet open={open} onClose={onClose} title="Visible to" testId="visibility-sheet">
      <div className="space-y-2" role="radiogroup" aria-label="Who can find you nearby">
        {(['everyone', 'event', 'connections'] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} disabled={v === 'event' && !hasEvents}
            onClick={() => { onPick(v); onClose() }} data-testid={`visibility-${v}`}
            className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-start disabled:opacity-50 ${value === v ? 'border-electric bg-soft-50 ring-2 ring-electric/20' : 'border-soft-200'}`}>
            <span className="flex-1"><span className="block font-semibold">{VIS_COPY[v].label}</span><span className="block text-sm text-ink-muted">{v === 'event' && !hasEvents ? 'You’re not at a live event right now.' : VIS_COPY[v].body}</span></span>
            {value === v && <Check className="h-5 w-5 text-electric" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-muted">You’re visible only while Nearby or Share is open.</p>
    </Sheet>
  )
}

function HowItWorks({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="How Nearby works" testId="how-nearby-works">
      <ul className="space-y-3 text-[15px] text-ink">
        <li><b>You choose.</b> Nearby is off until you turn it on, and you pick who can see you.</li>
        <li><b>Only while it’s open.</b> You appear while Nearby or Share is on screen, and disappear about two minutes after you leave.</li>
        <li><b>No exact location.</b> Your phone turns its position into a rough area (about 150 m) before anything is sent. ORYN never receives where you are exactly. At an event, the event is enough.</li>
        <li><b>Card first, details later.</b> People nearby see your card’s front. Details are exchanged only when you both agree — each of you gets what the other’s card allows.</li>
        <li><b>“Not now” is private.</b> They’re never told.</li>
      </ul>
      <p className="mt-4 text-xs text-ink-muted">Nearby uses your phone’s location or a shared event — not Bluetooth or NFC.</p>
    </Sheet>
  )
}

/** "[Name] would like to connect." Their card is the hero. Accept / Not now. */
export function IncomingSheet({ incoming, onRespond, onConnected }: { incoming: Incoming[]; onRespond: (id: string, accept: boolean) => Promise<{ connectionId: string | null }>; onConnected: (card: Card, name: string, connectionId: string | null) => void }) {
  const [dismissed, setDismissed] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const req = incoming.find((r) => !dismissed.includes(r.id))
  if (!req) return null
  const act = async (accept: boolean) => {
    setBusy(true); setErr(null)
    try {
      const r = await onRespond(req.id, accept)
      setDismissed((d) => [...d, req.id])
      if (accept) onConnected(req.card, req.name, r.connectionId)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Sheet open onClose={() => setDismissed((d) => [...d, req.id])} title={`${req.name} would like to connect`} testId="incoming-request">
      <CardPreview card={req.card} />
      <p className="text-center text-sm text-ink-muted">{[req.headline, req.industry ? INDUSTRY_LABEL[req.industry] : null].filter(Boolean).join(' · ')}</p>
      {err && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-signal-stop">{err}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" disabled={busy} onClick={() => act(false)} className="btn-more" data-testid="incoming-not-now">Not now</button>
        <button type="button" disabled={busy} onClick={() => act(true)} className="btn-share" data-testid="incoming-accept">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" aria-hidden="true" />} Accept</button>
      </div>
      <p className="mt-3 text-center text-xs text-ink-muted">If you accept, you exchange what each of your cards allows. “Not now” is private.</p>
    </Sheet>
  )
}

/**
 * The connection moment: two cards slide toward each other, touch, and the ORYN seal lands (~0.9 s).
 * Shown only after the server has confirmed the connection.
 */
export function ConnectedMoment({ mine, theirs, name, connectionId, onClose }: { mine: Card | null; theirs: Card | null; name: string; connectionId: string | null; onClose: () => void }) {
  const first = name.split(' ')[0]
  useEffect(() => { if ('vibrate' in navigator) try { navigator.vibrate?.([10, 40, 14]) } catch { /* not allowed */ } }, [])
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`You and ${first} are connected`} data-testid="connected-moment">
      <button type="button" className="absolute inset-0 animate-[fade_.2s_ease-out_both] bg-black/60" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-md animate-[sheet_.3s_cubic-bezier(.2,.9,.25,1)_both] rounded-t-[1.75rem] bg-white px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-7 text-center text-ink sm:rounded-[1.75rem]">
        <div className="relative mx-auto h-28 w-64" aria-hidden="true">
          <div className="oryn-merge-left absolute left-0 top-2 w-36">{mine ? <CardFace design={mine.design} identity={face(mine)} /> : <div className="aspect-[1.586] rounded-xl bg-navy-900" />}</div>
          <div className="oryn-merge-right absolute right-0 top-2 w-36">{theirs ? <CardFace design={theirs.design} identity={face(theirs)} /> : <div className="aspect-[1.586] rounded-xl bg-navy-700" />}</div>
          <span className="oryn-merge-seal absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-electric text-white shadow-lift ring-4 ring-white"><Check className="h-5 w-5" /></span>
        </div>
        <p className="mt-4 text-xl font-bold text-navy-900" data-testid="connected-toast">You and <bdi>{first}</bdi> are connected</p>
        <p className="mt-1 text-sm text-ink-muted">You each have what the other’s card allows.</p>
        <div className="mt-5 grid gap-2">
          {connectionId ? <Link href={`/connections/${connectionId}`} className="btn-share w-full" data-testid="open-in-people">Open in People</Link> : <Link href="/connections" className="btn-share w-full">Open People</Link>}
          {connectionId && <Link href={`/connections/${connectionId}?new=1#context`} className="btn-more w-full" data-testid="add-context">Add context</Link>}
        </div>
      </div>
    </div>
  )
}

/** Shows the moment when one of MY requests gets accepted (seen by polling; never before the server confirms). */
function useAcceptedMoment(outgoing: { id: string; name: string; status: string; connectionId: string | null; card?: Card | null }[] | undefined) {
  const [seen, setSeen] = useState<string[] | null>(null)
  const [show, setShow] = useState<{ name: string; connectionId: string | null; card: Card | null } | null>(null)
  useEffect(() => {
    if (!outgoing) return // not loaded yet: older acceptances aren't news
    const accepted = outgoing.filter((o) => o.status === 'accepted')
    if (seen === null) { setSeen(accepted.map((o) => o.id)); return }
    const fresh = accepted.find((o) => !seen.includes(o.id))
    if (fresh) { setShow({ name: fresh.name, connectionId: fresh.connectionId, card: fresh.card ?? null }); setSeen((s) => [...(s ?? []), fresh.id]) }
  }, [outgoing, seen])
  return { show, set: setShow }
}

function VisibilityPanel({ n, onAudience, onHow }: { n: ReturnType<typeof useNearby>; onAudience: () => void; onHow: () => void }) {
  const on = n.visibility !== 'off'
  const visible = on && n.presence === 'visible'
  return (
    <div className="rounded-2xl bg-white/[0.08] p-4 ring-1 ring-white/10">
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3" aria-hidden="true">
          {visible && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
          <span className={`relative inline-flex h-3 w-3 rounded-full ${visible ? 'bg-emerald-400' : 'bg-soft-300/70'}`} />
        </span>
        <p className="flex-1 text-[16px] font-semibold" data-testid="visibility-status">{visible ? 'Visible nearby' : on ? 'Not visible yet' : 'Not visible'}</p>
        <button type="button" role="switch" aria-checked={on} aria-label="Visible nearby"
          onClick={() => (on ? n.changeVisibility('off') : onAudience())} data-testid="visibility-switch"
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-white/25'}`}>
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} />
        </button>
      </div>
      {on && (
        <button type="button" onClick={onAudience} className="mt-3 flex min-h-[44px] w-full items-center justify-between rounded-xl bg-white/5 px-3 text-sm" data-testid="visibility-button">
          <span className="text-soft-200">Visible to</span>
          <span className="inline-flex items-center gap-1 font-semibold">{VIS_COPY[n.visibility as Exclude<Visibility, 'off'>].label} <ChevronDown className="h-4 w-4" aria-hidden="true" /></span>
        </button>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-soft-200">
        <span>{on ? 'You’re visible only while Nearby or Share is open.' : 'Turn on to see people around you — they’ll see you too.'}</span>
        <button type="button" onClick={onHow} className="inline-flex min-h-[32px] shrink-0 items-center gap-1 font-semibold text-white" data-testid="how-it-works"><Info className="h-3.5 w-3.5" aria-hidden="true" /> How it works</button>
      </div>
    </div>
  )
}

/** Small strip on the Share screen: keeps presence alive, says whether you're visible, surfaces requests. */
export function NearbyDock({ initialVisibility, myCard }: { initialVisibility: Visibility; myCard: Card }) {
  const n = useNearby({ initialVisibility, promptForLocation: false, pollMs: 2000 })
  const moment = useAcceptedMoment(n.data?.outgoing)
  const visible = n.visibility !== 'off' && n.presence === 'visible'
  return (
    <>
      <Link href="/share/nearby" className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-white/15" data-testid="nearby-pill">
        <span className={`h-2 w-2 rounded-full ${visible ? 'animate-pulse bg-emerald-400' : 'bg-soft-300/70'}`} aria-hidden="true" />
        {visible ? 'Visible nearby' : 'Not visible nearby'}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
      <IncomingSheet incoming={n.data?.incoming ?? []} onRespond={n.respond} onConnected={(card, name, connectionId) => moment.set({ name, connectionId, card })} />
      {moment.show && <ConnectedMoment mine={myCard} theirs={moment.show.card} name={moment.show.name} connectionId={moment.show.connectionId} onClose={() => moment.set(null)} />}
    </>
  )
}

export function NearbyScreen({ initialVisibility, events, presentHref, myCard }: { initialVisibility: Visibility; events: { id: string; name: string }[]; presentHref: string; myCard: Card | null }) {
  const n = useNearby({ initialVisibility, promptForLocation: true, pollMs: 2000 })
  const [audience, setAudience] = useState(false)
  const [how, setHow] = useState(false)
  const [person, setPerson] = useState<Person | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const moment = useAcceptedMoment(n.data?.outgoing)
  const people = n.data?.people ?? []
  const live = people.find((p) => p.handle === person?.handle) ?? person
  const impressed = useRef(false)

  useEffect(() => { trackClient('nearby_opened', { surface: 'nearby' }) }, [])
  useEffect(() => {
    if (!impressed.current && n.data && n.presence === 'visible') { impressed.current = true; trackClient('nearby_impression', { count: people.length }) }
  }, [n.data, n.presence, people.length])

  async function connect(p: Person) {
    setPending(p.handle); setErr(null)
    try {
      const r = await n.connect(p.handle)
      if (r.status === 'connected') { moment.set({ name: p.name, connectionId: r.connectionId ?? null, card: p.card }); setPerson(null) }
    } catch (e) { setErr((e as Error).message) } finally { setPending(null) }
  }
  function openPerson(p: Person) { setPerson(p); trackClient('nearby_profile_opened', { surface: 'nearby' }) }

  let body: React.ReactNode
  const locationProblem = n.loc === 'denied' || n.loc === 'unavailable'
  if (n.visibility === 'off') {
    body = (
      <div className="rounded-3xl bg-white/[0.06] p-6 text-center" data-testid="nearby-off">
        <Radar className="mx-auto h-9 w-9 text-electric-300" aria-hidden="true" />
        <p className="mt-3 text-xl font-bold">See who’s here</p>
        <p className="mx-auto mt-1 max-w-xs text-[15px] text-soft-100">Turn on Nearby to find ORYN members around you. They’ll see your card too — only while ORYN is open.</p>
        <button type="button" onClick={() => setAudience(true)} className="btn-share mt-5 w-full" data-testid="become-visible">Turn on Nearby</button>
        <Link href={presentHref} className="btn mt-2 w-full text-white hover:bg-white/10">Present my card instead</Link>
      </div>
    )
  } else if (n.presence === 'needs_event' || (n.visibility === 'event' && !n.eventId)) {
    body = (
      <div className="rounded-3xl bg-white/[0.06] p-6" data-testid="nearby-needs-event">
        <p className="text-lg font-bold">Which event are you at?</p>
        {events.length ? (
          <div className="mt-3 space-y-2">{events.map((e) => <button key={e.id} type="button" onClick={() => n.setEventId(e.id)} className="btn w-full justify-between bg-white/10 text-white">{e.name}<ChevronRight className="h-4 w-4" aria-hidden="true" /></button>)}</div>
        ) : <p className="mt-2 text-[15px] text-soft-100">You’re not at a live event right now. Choose “Everyone nearby” instead.</p>}
      </div>
    )
  } else if (n.presence === 'needs_location') {
    body = (
      <div className="rounded-3xl bg-white/[0.06] p-6 text-center" data-testid={locationProblem ? 'nearby-location-denied' : 'nearby-needs-location'}>
        <MapPin className="mx-auto h-9 w-9 text-electric-300" aria-hidden="true" />
        <p className="mt-3 text-xl font-bold">Location needed</p>
        <p className="mx-auto mt-1 max-w-xs text-[15px] text-soft-100">Turn on location to see people nearby. Only a rough area is used — never your exact spot.</p>
        {n.loc === 'denied' ? (
          <p className="mt-4 rounded-2xl bg-white/5 px-4 py-3 text-start text-sm text-soft-100">
            Location is blocked for ORYN. On iPhone: tap <b>aA</b> in the address bar → <b>Website Settings</b> → <b>Location</b> → Allow. In Chrome: tap the icon left of the address → <b>Permissions</b> → Location.
          </p>
        ) : (
          <button type="button" onClick={n.locate} disabled={n.loc === 'locating'} className="btn-share mt-5 w-full" data-testid="allow-location">
            {n.loc === 'locating' ? <><Loader2 className="h-5 w-5 animate-spin" /> Finding you…</> : n.loc === 'unavailable' ? 'Try again' : 'Enable location'}
          </button>
        )}
        {events.length > 0 && <button type="button" onClick={() => n.setEventId(events[0].id)} className="btn mt-2 w-full bg-white/10 text-white">Use {events[0].name} instead</button>}
        <Link href={presentHref} className="btn mt-2 w-full text-white hover:bg-white/10">Present my card instead</Link>
      </div>
    )
  } else if (n.presence === 'no_card') {
    body = <div className="rounded-3xl bg-white/[0.06] p-6 text-center"><p className="text-lg font-bold">Create your card first</p><Link href="/capsules/new" className="btn-share mt-4 w-full">Create my card</Link></div>
  } else if (!n.data || n.presence === 'idle') {
    body = (
      <ul className="space-y-3" aria-busy="true" aria-label="Looking for people nearby" data-testid="nearby-loading">
        {[0, 1, 2].map((i) => <li key={i} className="flex animate-pulse items-center gap-3 rounded-2xl bg-white/[0.06] p-3"><span className="aspect-[1.586] w-28 rounded-lg bg-white/10" /><span className="h-4 flex-1 rounded bg-white/10" /></li>)}
      </ul>
    )
  } else if (people.length === 0) {
    body = (
      <div className="rounded-3xl bg-white/[0.06] p-6 text-center" data-testid="nearby-empty">
        <span className="relative mx-auto flex h-14 w-14 items-center justify-center" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-electric/30" />
          <Radar className="relative h-8 w-8 text-electric-300" />
        </span>
        <p className="mt-3 text-xl font-bold">No one nearby yet</p>
        <p className="mx-auto mt-1 max-w-xs text-[15px] text-soft-100">When someone next to you opens ORYN, they’ll appear here. Meeting someone without ORYN? Show them your card.</p>
        <Link href={presentHref} className="btn mt-5 w-full bg-white text-navy-900">Present my card</Link>
      </div>
    )
  } else {
    body = (
      <>
        <p className="mb-3 text-[15px] font-semibold" data-testid="nearby-count">{people.length} {people.length === 1 ? 'person' : 'people'} nearby</p>
        <ul className="space-y-3">
          {people.map((p) => (
            <li key={p.handle} className="rounded-2xl bg-white/[0.08] p-3 ring-1 ring-white/10" data-testid="nearby-person">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => openPerson(p)} className="flex min-w-0 flex-1 items-center gap-3 text-start" data-testid="nearby-person-open">
                  <MiniCard card={p.card} />
                  <span className="min-w-0">
                    <span dir="auto" className="line-clamp-2 block text-[16px] font-semibold leading-snug text-white">{p.name}</span>
                    <span dir="auto" className="block truncate text-sm text-soft-100">{(p.card.company && !p.headline.includes(p.card.company) ? [p.headline, p.card.company] : [p.headline]).filter(Boolean).join(' · ') || 'ORYN member'}</span>
                    <span className="mt-1 inline-flex items-center whitespace-nowrap rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-soft-100">{p.isDemo ? 'Demo · ' : ''}{p.proximity.replace(' · demo', '')}</span>
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
        <h1 className="text-[28px] font-bold leading-tight">Nearby</h1>
        <div className="mt-4"><VisibilityPanel n={n} onAudience={() => setAudience(true)} onHow={() => { setHow(true); trackClient('nearby_how_it_works_opened', { surface: 'nearby' }) }} /></div>
        {!n.online && <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-signal-warn" role="status"><WifiOff className="h-4 w-4" aria-hidden="true" /> You’re offline. Nearby returns when you have signal — Present still works.</p>}
        {n.online && n.error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-signal-stop" role="alert" data-testid="nearby-error">{n.error}</p>}
        {err && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-signal-stop" role="alert">{err}</p>}
        <div className="mt-6">{body}</div>
      </div>

      <AudienceSheet open={audience} onClose={() => setAudience(false)} value={n.visibility === 'off' ? 'everyone' : n.visibility} onPick={n.changeVisibility} hasEvents={events.length > 0} />
      <HowItWorks open={how} onClose={() => setHow(false)} />
      <Sheet open={!!live} onClose={() => setPerson(null)} title={live?.name ?? ''} testId="person-sheet">
        {live && (
          <>
            <CardPreview card={live.card} testId="person-card" />
            <p className="text-center text-sm text-ink-muted">{[live.headline, live.industry ? INDUSTRY_LABEL[live.industry] : null, live.proximity.replace(' · demo', '')].filter(Boolean).join(' · ')}</p>
            {live.isDemo && <p className="mt-2 rounded-xl bg-soft-100 px-3 py-2 text-center text-xs font-semibold text-navy-900">Demo member · a fictional person for trying Nearby</p>}
            <div className="mt-4">
              {live.relation === 'connected' && live.connectionId
                ? <Link href={`/connections/${live.connectionId}`} className="btn-share w-full">Open in People</Link>
                : live.relation === 'requested'
                  ? <p className="btn-more w-full cursor-default" data-testid="person-requested">Request sent — waiting</p>
                  : <button type="button" onClick={() => connect(live)} disabled={pending === live.handle} className="btn-share w-full" data-testid="person-connect">{pending === live.handle ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" aria-hidden="true" />} {live.relation === 'requested_you' ? 'Accept and connect' : 'Connect'}</button>}
              <p className="mt-2 text-center text-xs text-ink-muted">Details are exchanged only when you both agree.</p>
            </div>
          </>
        )}
      </Sheet>
      <IncomingSheet incoming={n.data?.incoming ?? []} onRespond={n.respond} onConnected={(card, name, connectionId) => moment.set({ name, connectionId, card })} />
      {moment.show && <ConnectedMoment mine={myCard} theirs={moment.show.card} name={moment.show.name} connectionId={moment.show.connectionId} onClose={() => moment.set(null)} />}
    </div>
  )
}

function RelationButton({ p, busy, onConnect }: { p: Person; busy: boolean; onConnect: () => void }) {
  if (p.relation === 'connected') return <span className="inline-flex min-h-[40px] items-center gap-1 rounded-full bg-emerald-400/20 px-3 text-sm font-semibold text-emerald-200"><Check className="h-4 w-4" aria-hidden="true" /> Connected</span>
  if (p.relation === 'requested') return <span className="inline-flex min-h-[40px] items-center rounded-full bg-white/15 px-3 text-sm font-semibold text-white" data-testid="nearby-requested">Waiting…</span>
  return (
    <button type="button" onClick={onConnect} disabled={busy} className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-full bg-electric px-3.5 text-sm font-semibold text-white shadow-lift disabled:opacity-70" data-testid="nearby-connect">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />} {p.relation === 'requested_you' ? 'Accept' : 'Connect'}
    </button>
  )
}
