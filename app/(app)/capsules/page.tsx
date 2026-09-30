import Link from 'next/link'
import { Plus, QrCode, SlidersHorizontal, Star } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { listCapsules } from '@/lib/server/services/capsules'
import { setDefaultAction } from '@/app/actions/capsules'
import { MODE_COPY } from '@/lib/capsule-model'
import { Empty, PageHeader, relTime } from '@/components/ui'

export const metadata = { title: 'My Capsules' }

export default async function CapsulesPage() {
  const user = await requireUser()
  const capsules = await listCapsules(user.id)
  return (
    <>
      <PageHeader title="My Capsules" sub="Different moments, different details. Pick one when you share." action={<Link href="/capsules/new" className="btn-more"><Plus className="h-5 w-5" aria-hidden="true" /> New capsule</Link>} />
      {capsules.length === 0 ? (
        <Empty title="No capsules yet" body="Create one for the next place you’ll meet people." action={<Link href="/capsules/new" className="btn-share">Create a capsule</Link>} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {capsules.map((c) => {
            const shown = c.fields.filter((f) => f.value && f.layer === 'instant').length
            const more = c.fields.filter((f) => f.value && f.layer === 'expanded').length
            const hidden = c.fields.filter((f) => f.value && f.layer === 'hidden').length
            return (
              <li key={c.id} className="card flex flex-col overflow-hidden" data-testid="capsule-card">
                <Link href={`/capsules/${c.id}`} className="block bg-navy-900 px-5 py-4 text-white">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-soft-300">{MODE_COPY[c.mode].label}</span>
                    {c.is_default && <span className="chip bg-white/15 text-white"><Star className="h-3 w-3" aria-hidden="true" /> Default</span>}
                  </div>
                  <p className="mt-2 text-lg font-bold">{c.name}</p>
                  <p className="text-sm text-soft-200">{c.display_name}{c.headline ? ` · ${c.headline}` : ''}</p>
                </Link>
                <div className="flex-1 px-5 py-3 text-sm text-ink-muted">
                  {shown} shown first · {more} on “Learn more” · {hidden} not shared
                  <br />
                  {c.active_shares > 0 ? <span className="font-semibold text-signal-ok">Sharing now ({c.active_shares})</span> : <>Edited {relTime(c.updated_at)}</>}
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-soft-100 p-3">
                  <Link href={`/share?capsule=${c.id}`} className="btn-share min-h-[44px] px-2 text-sm"><QrCode className="h-4 w-4" aria-hidden="true" /> Share</Link>
                  <Link href={`/capsules/${c.id}/visibility`} className="btn-more min-h-[44px] px-2 text-sm"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Rules</Link>
                  {c.is_default ? (
                    <Link href={`/capsules/${c.id}`} className="btn-more min-h-[44px] px-2 text-sm">Edit</Link>
                  ) : (
                    <form action={setDefaultAction}><input type="hidden" name="id" value={c.id} /><button className="btn-more min-h-[44px] w-full px-2 text-sm">Set default</button></form>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
