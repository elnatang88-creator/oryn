import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/request'
import { listCapsules, getCapsule } from '@/lib/server/services/capsules'
import { listEvents } from '@/lib/server/services/events'
import { startShareAction } from '@/app/actions/sharing'
import { ActionForm, Submit } from '@/components/Forms'
import { PageHeader, Empty } from '@/components/ui'
import { DURATION_PRESETS, MODE_COPY } from '@/lib/capsule-model'

export const metadata = { title: 'Share' }

export default async function SharePage({ searchParams }: { searchParams: Promise<{ capsule?: string; quick?: string }> }) {
  const sp = await searchParams
  if (sp.quick) redirect('/share/quick')
  const user = await requireUser()
  const capsules = await listCapsules(user.id)
  if (!capsules.length) return (<><PageHeader title="Share" /><Empty title="Create a capsule first" body="It’s what people will see." action={<Link href="/capsules/new" className="btn-share">Create a capsule</Link>} /></>)
  const selected = capsules.find((c) => c.id === sp.capsule) ?? capsules[0]
  const { policy } = await getCapsule(user.id, selected.id)
  const events = (await listEvents(user.id)).filter((e) => e.status === 'live')

  return (
    <>
      <PageHeader title="Share" sub="Choose the capsule for this moment." />
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Capsule">
        {capsules.map((c) => (
          <Link key={c.id} href={`/share?capsule=${c.id}`} role="tab" aria-selected={c.id === selected.id}
            className={`shrink-0 rounded-2xl border px-4 py-2.5 ${c.id === selected.id ? 'border-electric bg-electric text-white' : 'border-soft-300 bg-white'}`}>
            <span className="block text-sm font-bold">{c.name}</span>
            <span className={`block text-xs ${c.id === selected.id ? 'text-soft-200' : 'text-ink-muted'}`}>{MODE_COPY[c.mode].label}</span>
          </Link>
        ))}
      </div>
      <ActionForm action={startShareAction} className="card space-y-5 p-5">
        <input type="hidden" name="capsuleId" value={selected.id} />
        <input type="hidden" name="one_time_field" value="1" />
        <div>
          <label className="label" htmlFor="context">Where are you? <span className="font-normal text-ink-muted">— only you see this</span></label>
          <input id="context" name="context" className="input" placeholder="e.g. Harbor Summit, Hall B" maxLength={80} />
        </div>
        {events.length > 0 && (
          <div>
            <label className="label" htmlFor="eventId">At an event?</label>
            <select id="eventId" name="eventId" className="input">
              <option value="">No</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <p className="hint mt-1">The event’s sharing rules will apply.</p>
          </div>
        )}
        <div>
          <label className="label" htmlFor="duration">Open for</label>
          <select id="duration" name="duration" className="input" defaultValue={policy.duration_minutes ?? 'none'}>
            {DURATION_PRESETS.map((d) => <option key={d.label} value={d.minutes ?? 'none'}>{d.label}</option>)}
          </select>
        </div>
        <label className="flex min-h-[48px] cursor-pointer items-center gap-3">
          <input type="checkbox" name="one_time" defaultChecked={policy.one_time} className="h-5 w-5 accent-electric" />
          <span><span className="font-semibold">Opens once</span> <span className="hint">— for one person only</span></span>
        </label>
        <Submit pendingText="Starting…">Start sharing</Submit>
      </ActionForm>
    </>
  )
}
