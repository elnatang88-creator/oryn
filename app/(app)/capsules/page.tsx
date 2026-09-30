import Link from 'next/link'
import { Pencil, Plus, SlidersHorizontal } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { listCapsules } from '@/lib/server/services/capsules'
import { cardFor } from '@/lib/server/services/owner-card'
import { MODE_COPY } from '@/lib/capsule-model'
import { CardFace } from '@/components/LuxuryCard'
import { ExchangeCardsIcon } from '@/components/OrynIcons'
import { Empty, PageHeader, relTime } from '@/components/ui'

export const metadata = { title: 'My cards' }

/**
 * One identity, several cards. Each card is a projection of you for a context (work, conference, personal…):
 * the front and back people see first, plus its capsule — what else they get on "Learn more" (deck, booking,
 * portfolio). The active card is the one Share, Nearby, Present and Wallet use.
 */
export default async function CardsPage() {
  const user = await requireUser()
  const capsules = await listCapsules(user.id)
  return (
    <>
      <PageHeader title="My cards" sub="One identity, a card for each context. You choose what each one shows." action={<Link href="/capsules/new" className="btn-more"><Plus className="h-5 w-5" aria-hidden="true" /> New card</Link>} />
      {capsules.length === 0 ? (
        <Empty title="No card yet" body="Create your first card — it takes about a minute." action={<Link href="/capsules/new" className="btn-share">Create my card</Link>} />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2">
          {capsules.map((c) => {
            const { design, identity } = cardFor(c)
            const shown = c.fields.filter((f) => f.value && f.layer === 'instant').length
            const more = c.fields.filter((f) => f.value && f.layer === 'expanded').length
            const hidden = c.fields.filter((f) => f.value && f.layer === 'hidden').length
            return (
              <li key={c.id} className="card flex flex-col p-4" data-testid="capsule-card">
                <Link href={`/capsules/${c.id}`} className="mx-auto block w-full max-w-[300px]" aria-label={`Edit ${c.name}`}><CardFace design={design} identity={identity} /></Link>
                <div className="mt-4 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p dir="auto" className="truncate text-lg font-bold text-navy-900">{c.name}</p>
                    <p className="text-sm text-ink-muted">{MODE_COPY[c.mode].label} · {c.active_shares > 0 ? <span className="font-semibold text-signal-ok">sharing now</span> : `edited ${relTime(c.updated_at)}`}</p>
                  </div>
                  {c.is_default && <span className="chip-public shrink-0" data-testid="active-card">Active card</span>}
                </div>
                <p className="mt-2 text-sm text-ink-muted">{shown} on the card · {more} in its capsule (Learn more) · {hidden} private</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <a href={`/share/use?capsule=${c.id}`} className="btn-share min-h-[44px] px-2 text-sm"><ExchangeCardsIcon className="h-4 w-4" /> {c.is_default ? 'Share' : 'Use'}</a>
                  <Link href={`/capsules/${c.id}`} className="btn-more min-h-[44px] px-2 text-sm"><Pencil className="h-4 w-4" aria-hidden="true" /> Edit</Link>
                  <Link href={`/capsules/${c.id}/visibility`} className="btn-more min-h-[44px] px-2 text-sm"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Rules</Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
