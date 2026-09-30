import Link from 'next/link'
import { Eye, Lock } from 'lucide-react'
import { INDUSTRY_LABEL } from '@/lib/industries'
import { relTime } from './ui'
import type { MemberViewer } from '@/lib/server/services/viewers'

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·'

/** "Viewed your card": live pulse, members by name on Premium, counts plus a teaser otherwise. */
export function ViewersPanel({ summary, viewers }: { summary: { opens: number; members: number; recent_members: number; canSeeWho: boolean }; viewers: MemberViewer[] | null }) {
  const fresh = (d: Date | string) => Date.now() - new Date(d).getTime() < 24 * 3600 * 1000
  return (
    <section className="mb-8" data-testid="viewers-panel">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="h2 flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-electric-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-electric" />
          </span>
          Viewed your card
        </h2>
        <span className="text-sm text-ink-muted">Live · 30 days</span>
      </div>
      <div className="card mb-3 grid grid-cols-3 divide-x divide-soft-100 bg-navy-900 text-white">
        {[['Opens', summary.opens], ['ORYN members', summary.members], ['Last 24h', summary.recent_members]].map(([k, v]) => (
          <div key={k} className="animate-rise px-3 py-4 text-center">
            <p className="text-3xl font-bold tabular-nums" data-testid={`viewers-${String(k).toLowerCase().replace(/\W+/g, '-')}`}>{v}</p>
            <p className="text-xs text-soft-300">{k}</p>
          </div>
        ))}
      </div>
      {viewers ? (
        viewers.length === 0 ? (
          <p className="card px-4 py-4 text-[15px] text-ink-muted">When an ORYN member opens your capsule, they appear here. People without an account stay anonymous.</p>
        ) : (
          <ul className="card divide-y divide-soft-100 overflow-hidden">
            {viewers.map((v, i) => (
              <li key={v.id} className="flex animate-rise items-center gap-3 px-4 py-3" style={{ animationDelay: `${i * 60}ms` }} data-testid="viewer-row">
                <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#d8b56a] to-[#8a6a2f] text-sm font-bold text-navy-900">
                  {initials(v.name)}
                  {fresh(v.last_viewed_at) && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-electric" aria-label="New" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span dir="auto" className="block truncate font-semibold">{v.name}</span>
                  <span dir="auto" className="block truncate text-sm text-ink-muted">{v.headline || 'ORYN member'}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
                    {v.industry && <span className="rounded-full bg-[#f4ecd8] px-2 py-0.5 font-semibold text-[#6b5122]">{INDUSTRY_LABEL[v.industry]}</span>}
                    <span className="truncate">{v.capsule_name}{v.expanded ? ' · read more' : ''}{v.view_count > 1 ? ` · ${v.view_count} visits` : ''}</span>
                  </span>
                </span>
                <span className="shrink-0 text-sm text-ink-muted">{relTime(v.last_viewed_at)}</span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="card relative overflow-hidden px-4 py-4">
          <ul aria-hidden="true" className="space-y-3 blur-[6px]">
            {Array.from({ length: Math.min(3, Math.max(1, summary.members)) }).map((_, i) => (
              <li key={i} className="flex items-center gap-3"><span className="h-11 w-11 rounded-full bg-soft-200" /><span className="h-4 flex-1 rounded bg-soft-100" /></li>
            ))}
          </ul>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/60 px-4 text-center">
            <p className="flex items-center gap-2 text-[15px] font-semibold"><Lock className="h-4 w-4" aria-hidden="true" />
              {summary.members ? `${summary.members} ORYN ${summary.members === 1 ? 'member' : 'members'} viewed you` : 'See which members view you'}
            </p>
            <Link href="/settings/plan" className="btn-more min-h-[40px] text-sm" data-testid="viewers-upgrade"><Eye className="h-4 w-4" aria-hidden="true" /> See who, with Pro</Link>
          </div>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-muted">Members who view privately, and people without an ORYN account, are counted but never named.</p>
    </section>
  )
}
