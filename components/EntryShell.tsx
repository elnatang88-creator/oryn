import type { CSSProperties, ReactNode } from 'react'
import { CardFace } from './LuxuryCard'
import { Logo } from './Logo'
import { DEFAULT_DESIGN, PRESETS, type CardDesign } from '@/lib/card-design'

// Sample cards only: fictional names, never real people.
const FAN: { preset: string; name: string; headline: string; base?: string }[] = [
  { preset: 'pearl', name: 'Maya Stone', headline: 'Designer' },
  { preset: 'black', name: 'Noa Adler', headline: 'Product lead' },
  { preset: 'navy', name: 'Eli Ward', headline: 'Founder' },
]
const design = (id: string): CardDesign => ({ ...DEFAULT_DESIGN, ...PRESETS.find((p) => p.id === id)!.design })

/**
 * The app's entry screen: a dark stage with a fan of luxury cards drifting in, and a bottom sheet for the
 * actions — the first thing someone sees when they open the installed app. Pure CSS motion (respects
 * reduced motion); renders on the server.
 */
export function EntryShell({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <main id="main" className="entry-stage relative flex min-h-dvh flex-col overflow-hidden text-white">
      <div aria-hidden="true" className="entry-glow" />
      <header className="relative z-10 flex justify-center pt-[max(env(safe-area-inset-top),1.25rem)]">
        <span className="entry-logo"><Logo tone="white" height={compact ? 24 : 30} /></span>
      </header>
      <div aria-hidden="true" className={`relative z-0 mx-auto w-full max-w-md flex-1 ${compact ? 'min-h-[180px]' : 'min-h-[300px]'}`}>
        <div className={`entry-fan ${compact ? 'entry-fan-compact' : ''}`}>
          {FAN.map((c, i) => (
            <div key={c.preset} className="entry-card" style={{ '--i': i } as CSSProperties}>
              <div className="entry-card-inner"><CardFace design={design(c.preset)} identity={{ displayName: c.name, headline: c.headline, company: null, avatarUrl: null }} /></div>
            </div>
          ))}
        </div>
      </div>
      <section className="entry-sheet relative z-10 mx-auto w-full max-w-md rounded-t-[2rem] bg-white px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-6 text-ink shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.6)] sm:mb-8 sm:rounded-[2rem]">
        {children}
      </section>
    </main>
  )
}
