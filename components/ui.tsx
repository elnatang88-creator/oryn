import Link from 'next/link'
import { Lock, Globe2 } from 'lucide-react'

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 animate-rise">
      <div>
        <h1 className="h1">{title}</h1>
        {sub && <p className="mt-1 text-[15px] text-ink-muted">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="h2">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="card px-6 py-8 text-center">
      <p className="font-semibold text-navy-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export const PublicBadge = ({ children = 'Visible to people you share with' }: { children?: React.ReactNode }) => (
  <span className="chip-public"><Globe2 className="h-3.5 w-3.5" aria-hidden="true" /> {children}</span>
)
export const PrivateBadge = ({ children = 'Only you' }: { children?: React.ReactNode }) => (
  <span className="chip-private"><Lock className="h-3.5 w-3.5" aria-hidden="true" /> {children}</span>
)

export function PlanGate({ message }: { message: string }) {
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 border-dashed px-5 py-4">
      <p className="text-sm text-ink-muted">{message}</p>
      <Link href="/settings/plan" className="btn-more min-h-[40px] text-sm">See plans</Link>
    </div>
  )
}

export function relTime(d: Date | string, now = Date.now()) {
  const ms = now - new Date(d).getTime()
  const m = Math.round(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const days = Math.round(h / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

export function fmtDate(d: string | Date) {
  const s = typeof d === 'string' ? d : d.toISOString().slice(0, 10)
  const [y, m, day] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}
