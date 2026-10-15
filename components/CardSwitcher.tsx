'use client'

import { useState } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import Link from 'next/link'
import { Sheet } from './Sheet'
import { CardFace, type CardIdentity } from './LuxuryCard'
import type { CardDesign } from '@/lib/card-design'
import { trackClient } from '@/lib/track-client'

export interface SwitchCard { id: string; name: string; mode: string; design: CardDesign; identity: CardIdentity }

/** Which card am I about to give? Always visible above the card; switching is one tap. */
export function CardSwitcher({ activeId, activeName, cards }: { activeId: string; activeName: string; cards: SwitchCard[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white/10 px-4 text-[15px] font-semibold text-white hover:bg-white/15" data-testid="switch-card">
        <span className="text-soft-300">Using</span> <span dir="auto">{activeName}</span> <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Which card?" testId="card-switcher">
        <ul className="max-h-[60dvh] space-y-2 overflow-y-auto">
          {cards.map((c) => (
            <li key={c.id}>
              {/* Plain anchor: switching starts a share, so it must never be prefetched. */}
              <a href={`/share/use?capsule=${encodeURIComponent(c.id)}`} onClick={() => trackClient('card_selected', { card_id: c.id, surface: 'share' })}
                className={`flex items-center gap-3 rounded-2xl border p-2 ${c.id === activeId ? 'border-electric bg-soft-50' : 'border-soft-200'}`} data-testid={`switch-to-${c.id}`}>
                <span className="w-24 shrink-0"><CardFace design={c.design} identity={c.identity} /></span>
                <span className="min-w-0 flex-1"><span dir="auto" className="block truncate font-semibold">{c.name}</span><span className="block text-sm capitalize text-ink-muted">{c.mode}</span></span>
                {c.id === activeId && <Check className="h-5 w-5 text-electric" aria-label="In use" />}
              </a>
            </li>
          ))}
        </ul>
        <Link href="/capsules/new" className="btn-more mt-3 w-full"><Plus className="h-5 w-5" aria-hidden="true" /> New card</Link>
      </Sheet>
    </>
  )
}
