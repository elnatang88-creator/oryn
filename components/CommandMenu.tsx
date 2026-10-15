'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, CalendarDays, CreditCard, QrCode, Search, UserRound, Users } from 'lucide-react'
import { Sheet } from './Sheet'

type Hit = { kind: 'person' | 'event' | 'station' | 'lead' | 'workspace' | 'card'; id: string; title: string; sub: string; href: string }
const ICON = { person: UserRound, lead: Briefcase, event: CalendarDays, card: CreditCard, station: QrCode, workspace: Users }
const PAGES: Hit[] = [
  { kind: 'card', id: 'p1', title: 'Share my card', sub: 'Open my active card', href: '/share/quick' },
  { kind: 'person', id: 'p2', title: 'People', sub: 'Everyone you exchanged cards with', href: '/connections' },
  { kind: 'event', id: 'p3', title: 'Events', sub: 'Your events and registrations', href: '/events' },
  { kind: 'lead', id: 'p4', title: 'Business', sub: 'Leads, tasks, automations', href: '/business' },
  { kind: 'station', id: 'p5', title: 'Stations', sub: 'NFC and QR stations', href: '/stations' },
]

/** A trigger for the (single) CommandMenu mounted in the shell. */
export function SearchButton({ compact = false }: { compact?: boolean }) {
  return compact
    ? <button type="button" onClick={() => window.dispatchEvent(new Event('oryn:search'))} className="btn-quiet" aria-label="Search" data-testid="open-search-mobile"><Search className="h-5 w-5" /></button>
    : <button type="button" onClick={() => window.dispatchEvent(new Event('oryn:search'))} className="btn-quiet w-full justify-start" aria-label="Search (⌘K)" data-testid="open-search"><Search className="h-5 w-5" /> <span className="ml-1 text-sm">Search</span><kbd className="ml-auto rounded border border-soft-300 px-1.5 text-[10px] text-ink-muted">⌘K</kbd></button>
}

/** ⌘K / Ctrl+K: search people, leads, events, cards, stations and workspaces you can see. */
export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [sel, setSel] = useState(0)
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o) } }
    const o = () => setOpen(true)
    window.addEventListener('keydown', k); window.addEventListener('oryn:search', o)
    return () => { window.removeEventListener('keydown', k); window.removeEventListener('oryn:search', o) }
  }, [])
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 50); else { setQ(''); setHits([]) } }, [open])
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return }
    const t = setTimeout(async () => {
      try { const r = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' }); if (r.ok) { setHits((await r.json()).data); setSel(0) } } catch { /* offline */ }
    }, 150)
    return () => clearTimeout(t)
  }, [q])
  const list = q.trim().length < 2 ? PAGES.filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase())) : hits
  const go = (h: Hit) => { setOpen(false); if (h.href.startsWith('/share/quick')) window.location.assign(h.href); else router.push(h.href) }
  return (
    <>
      <Sheet open={open} onClose={() => setOpen(false)} title="Search" testId="command-menu">
        <input ref={input} dir="auto" value={q} onChange={(e) => setQ(e.target.value)} className="input mt-0" placeholder="People, leads, events, cards, stations…" aria-label="Search" data-testid="search-input"
          onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(list.length - 1, s + 1)) } if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)) } if (e.key === 'Enter' && list[sel]) go(list[sel]) }} />
        <ul className="mt-3 max-h-[50dvh] divide-y divide-soft-100 overflow-y-auto" role="listbox" data-testid="search-results">
          {list.length === 0 && <li className="py-3 text-sm text-ink-muted">Nothing matches.</li>}
          {list.map((h, i) => { const I = ICON[h.kind]; return (
            <li key={h.kind + h.id} role="option" aria-selected={i === sel}>
              <button type="button" onClick={() => go(h)} onMouseEnter={() => setSel(i)} className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl px-2 text-start ${i === sel ? 'bg-soft-100' : ''}`}>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-soft-100 text-electric-600"><I className="h-4 w-4" aria-hidden="true" /></span>
                <span className="min-w-0"><span dir="auto" className="block truncate font-semibold">{h.title}</span><span dir="auto" className="block truncate text-xs text-ink-muted">{h.sub}</span></span>
              </button>
            </li>) })}
        </ul>
      </Sheet>
    </>
  )
}
