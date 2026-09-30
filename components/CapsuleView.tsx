import { hrefForField, type PublicCapsuleView } from '@/lib/capsule-model'
import { FieldIcon } from './FieldIcon'
import { ArrowUpRight, Clock, Eye, Lock } from 'lucide-react'
import { Logo } from './Logo'

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '•'
}

function prettyValue(kind: string, value: string) {
  if (['website', 'social', 'booking', 'link'].includes(kind)) return value.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  return value
}

export function timeLeft(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return 'Expired'
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m} min left`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} h left`
  return `${Math.round(h / 24)} days left`
}

/**
 * The Identity Capsule as a recipient sees it. Top: who, and a plain statement of what this is.
 * Bottom: only the fields the sender chose for this layer, as large tap targets.
 */
export function CapsuleView({ view, preview = false, now }: { view: PublicCapsuleView; preview?: boolean; now?: number }) {
  const primary = view.fields.find((f) => f.id === view.primaryFieldId)
  const rest = view.fields.filter((f) => f.id !== view.primaryFieldId)
  const left = timeLeft(view.expiresAt, now)
  return (
    <article className="overflow-hidden rounded-capsule bg-white shadow-capsule" aria-label={`${view.displayName}’s ORYN capsule`}>
      <header className="relative bg-navy-900 px-6 pb-7 pt-5 text-white">
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-soft-200" data-testid="viewing-indicator">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            {view.modeLabel} capsule{view.layer === 'expanded' ? ' · more details' : ''}
          </span>
          {view.eventName && <span className="rounded-full bg-white/10 px-2.5 py-1">{view.eventName}</span>}
          {left && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {left}
            </span>
          )}
          {view.oneTime && <span className="rounded-full bg-white/10 px-2.5 py-1">Opens once</span>}
        </div>
        <div className="mt-6 flex items-center gap-4">
          {view.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white/20" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-electric text-xl font-bold" aria-hidden="true">{initials(view.displayName)}</div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-[24px] font-bold leading-tight" data-testid="capsule-name">{view.displayName}</h1>
            {view.headline && <p className="mt-0.5 text-[15px] text-soft-200">{view.headline}</p>}
          </div>
        </div>
        {view.message && <p className="mt-5 rounded-2xl bg-white/[0.07] px-4 py-3 text-[15px] leading-relaxed text-white/95">“{view.message}”</p>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/oryn-mark.svg" alt="" aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 opacity-[0.12]" />
      </header>

      <div className="space-y-2 p-4">
        {primary && <FieldRow f={primary} primary preview={preview} />}
        {rest.map((f) => <FieldRow key={f.id} f={f} preview={preview} />)}
        {view.fields.length === 0 && <p className="px-2 py-3 text-center text-sm text-ink-muted">Just a hello — nothing else was shared.</p>}
      </div>
      <footer className="flex items-center justify-between border-t border-soft-100 px-5 py-3 text-[12px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" aria-hidden="true" /> Shared on purpose. Only what they chose.</span>
        <Logo height={14} />
      </footer>
    </article>
  )
}

function FieldRow({ f, primary = false, preview }: { f: PublicCapsuleView['fields'][number]; primary?: boolean; preview: boolean }) {
  const href = hrefForField(f)
  const external = href?.startsWith('http')
  const body = (
    <>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${primary ? 'bg-white/15 text-white' : 'bg-soft-100 text-electric-600'}`}>
        <FieldIcon kind={f.kind} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[12px] font-semibold ${primary ? 'text-soft-200' : 'text-ink-muted'}`}>{f.label}</span>
        <span className={`block truncate text-[15px] font-semibold ${primary ? 'text-white' : 'text-ink'}`}>{prettyValue(f.kind, f.value)}</span>
      </span>
      {href && <ArrowUpRight className={`h-5 w-5 shrink-0 ${primary ? 'text-white' : 'text-ink-faint'}`} aria-hidden="true" />}
    </>
  )
  const cls = `flex min-h-[60px] items-center gap-3 rounded-2xl px-3 py-2.5 ${primary ? 'bg-electric text-white' : 'bg-soft-50 hover:bg-soft-100'}`
  if (!href || preview) return <div className={cls}>{body}</div>
  return (
    <a href={href} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}>
      {body}
    </a>
  )
}
