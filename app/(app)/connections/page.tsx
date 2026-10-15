import Link from 'next/link'
import { ArrowRight, BellRing, Search, X } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { listConnections, listRequests, SUGGESTED_TAGS } from '@/lib/server/services/connections'
import { CardFace } from '@/components/LuxuryCard'
import { normalizeDesign } from '@/lib/card-design'
import { Empty, PageHeader, relTime, fmtDate } from '@/components/ui'

export const metadata = { title: 'People' }

const VIA: Record<string, string> = { nearby: 'Nearby', qr: 'Your card', link: 'Your card', web_share: 'Your card', shortcut: 'Your card', wallet_pass: 'Wallet', station: 'Station', kept: 'Their card', manual: 'Added' }

/** People = relationship memory. Search finds people by who they are, where you met, your tags and your notes. */
export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string }> }) {
  const { q = '', tag = '' } = await searchParams
  const user = await requireUser()
  const [people, pending, all] = await Promise.all([listConnections(user.id, q, { tag }), listRequests(user.id), q || tag ? listConnections(user.id) : null])
  const total = (all ?? people).length
  const usedTags = [...new Set((all ?? people).flatMap((c) => c.tags))]
  const tags = [...new Set([...usedTags, ...SUGGESTED_TAGS.filter((t) => usedTags.includes(t))])]
  return (
    <>
      <PageHeader title="People" sub={total ? `${total} ${total === 1 ? 'person' : 'people'} · where you met and why` : 'Everyone you exchange cards with, with where you met and why.'} />
      {pending.length > 0 && (
        <Link href="/connections/requests" className="card mb-5 flex min-h-[56px] items-center justify-between px-4 py-3 hover:border-electric-400" data-testid="requests-link">
          <span className="font-semibold">{pending.length} request{pending.length === 1 ? '' : 's'} waiting</span>
          <ArrowRight className="h-5 w-5 text-ink-faint" aria-hidden="true" />
        </Link>
      )}
      {total > 0 && (
        <form className="relative mb-3" role="search">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          {tag && <input type="hidden" name="tag" value={tag} />}
          <input dir="auto" name="q" defaultValue={q} className="input mt-0 pl-12" placeholder="Name, company, event, tag or note" aria-label="Search people" data-testid="people-search" />
        </form>
      )}
      {tags.length > 0 && (
        <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Filter by tag">
          {tag && <Link href={`/connections${q ? `?q=${encodeURIComponent(q)}` : ''}`} className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-full bg-navy-900 px-3.5 text-sm font-semibold text-white">{tag} <X className="h-4 w-4" aria-label="Clear tag" /></Link>}
          {tags.filter((t) => t !== tag).map((t) => (
            <Link key={t} href={`/connections?tag=${encodeURIComponent(t)}${q ? `&q=${encodeURIComponent(q)}` : ''}`} className="inline-flex min-h-[40px] shrink-0 items-center rounded-full border border-soft-300 bg-white px-3.5 text-sm font-semibold text-ink hover:border-electric">{t}</Link>
          ))}
        </div>
      )}
      {people.length === 0 ? (
        q || tag
          ? <Empty title="No one matches" body={`Nothing for “${q || tag}”. Try a name, a company, an event or a tag.`} action={<Link href="/connections" className="btn-more">Clear search</Link>} />
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- opens a share, never prefetched
          : <Empty title="Your people will live here" body="When you exchange cards — nearby, by presenting your card or with a link — the person appears here with where you met." action={<a href="/share/quick" className="btn-share">Share my card</a>} />
      ) : (
        <ul className="space-y-2" data-testid="people-list">
          {people.map((c) => {
            const card = c.card ? { ...c.card, design: normalizeDesign(c.card.design) } : null
            const via = VIA[c.channel ?? '']
            const where = c.event_name ?? (c.met_where && c.met_where !== via ? c.met_where : null)
            return (
              <li key={c.id}>
                <Link href={`/connections/${c.id}`} className="card flex min-h-[76px] items-center gap-3 px-3 py-3 hover:border-electric-400">
                  {card
                    ? <span className="w-20 shrink-0" aria-hidden="true"><CardFace design={card.design} identity={{ displayName: card.displayName, headline: card.headline, company: card.company, avatarUrl: null }} /></span>
                    : <span className="grid aspect-[1.586] w-20 shrink-0 place-items-center rounded-lg bg-soft-100 text-sm font-bold text-navy-900" aria-hidden="true">{c.name.split(' ').map((p) => [...p][0]).slice(0, 2).join('')}</span>}
                  <span className="min-w-0 flex-1">
                    <span dir="auto" className="block truncate font-semibold">{c.name}</span>
                    {(c.headline || card?.company) && <span dir="auto" className="block truncate text-sm text-ink-muted">{[c.headline, card?.company].filter(Boolean).join(' · ')}</span>}
                    <span className="block truncate text-xs text-ink-muted">{[where, via, relTime(c.met_at)].filter(Boolean).join(' · ')}</span>
                    {c.tags.length > 0 && <span className="mt-1 flex flex-wrap gap-1">{c.tags.slice(0, 3).map((t) => <span key={t} className="chip-muted">{t}</span>)}</span>}
                  </span>
                  {c.next_due && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-soft-100 px-2.5 py-1 text-xs font-semibold text-electric-600"><BellRing className="h-3.5 w-3.5" aria-hidden="true" />{fmtDate(c.next_due)}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
