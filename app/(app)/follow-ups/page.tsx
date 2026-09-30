import Link from 'next/link'
import { CheckCircle2, Circle } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { listFollowUps } from '@/lib/server/services/connections'
import { toggleFollowUpAction } from '@/app/actions/connections'
import { Empty, PageHeader, fmtDate } from '@/components/ui'

export const metadata = { title: 'Follow-ups' }

export default async function FollowUpsPage() {
  const user = await requireUser()
  const items = await listFollowUps(user.id)
  const today = new Date().toISOString().slice(0, 10)
  const open = items.filter((f) => !f.done_at)
  const done = items.filter((f) => f.done_at)
  return (
    <>
      <PageHeader title="Follow-ups" sub="Small promises, kept." />
      {open.length === 0 && <Empty title="Nothing to follow up" body="Set a follow-up from any connection." action={<Link href="/connections" className="btn-more">Go to connections</Link>} />}
      {open.length > 0 && (
        <ul className="card divide-y divide-soft-100">
          {open.map((f) => (
            <li key={f.id} className="flex items-center gap-2 px-3 py-2">
              <form action={toggleFollowUpAction}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="done" value="true" />
                <button className="grid h-11 w-11 place-items-center rounded-xl text-ink-faint hover:text-signal-ok" aria-label={`Mark “${f.title}” done`}><Circle className="h-6 w-6" /></button></form>
              <Link href={`/connections/${f.connection_id}`} className="min-w-0 flex-1 py-1">
                <span className="block truncate font-medium">{f.title}</span>
                <span className={`block text-sm ${f.due_on < today ? 'text-signal-warn' : 'text-ink-muted'}`}>{f.name} · {fmtDate(f.due_on)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <>
          <h2 className="h2 mb-3 mt-8">Done this week</h2>
          <ul className="card divide-y divide-soft-100">
            {done.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3 text-ink-muted"><CheckCircle2 className="h-5 w-5 text-signal-ok" aria-hidden="true" /><span className="line-through">{f.title}</span><span className="text-sm">· {f.name}</span></li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
