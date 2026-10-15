import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/server/request'
import { getDb } from '@/lib/server/db'
import { has, userPlan } from '@/lib/server/plans'
import { getCapsule } from '@/lib/server/services/capsules'
import { AppError } from '@/lib/server/errors'
import { updatePolicyAction } from '@/app/actions/capsules'
import { ActionForm, Submit } from '@/components/Forms'
import { PageHeader, PrivateBadge, PublicBadge } from '@/components/ui'
import { DURATION_PRESETS, INTERACTION_COPY, INTERACTION_LEVELS, LAYER_COPY } from '@/lib/capsule-model'

export const metadata = { title: 'Sharing rules' }

export default async function VisibilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const res = await getCapsule(user.id, id).catch((e) => { if (e instanceof AppError) return null; throw e })
  if (!res) notFound()
  const { capsule: c, policy: p } = res
  const plan = await userPlan(await getDb(), user.id)
  const byLayer = (l: 'instant' | 'expanded' | 'hidden') => c.fields.filter((f) => f.value && f.layer === l)

  return (
    <>
      <PageHeader title="Sharing rules" sub={`For “${c.name}”. These apply to each new share.`} />

      <section className="card mb-6 p-5" aria-labelledby="summary">
        <h2 id="summary" className="h2">Who sees what</h2>
        <dl className="mt-4 space-y-4">
          {(['instant', 'expanded', 'hidden'] as const).map((l) => (
            <div key={l}>
              <dt className="flex items-center gap-2 text-sm font-semibold">{l === 'hidden' ? <PrivateBadge>{LAYER_COPY[l].label}</PrivateBadge> : <PublicBadge>{LAYER_COPY[l].label}</PublicBadge>} <span className="font-normal text-ink-muted">{LAYER_COPY[l].hint}</span></dt>
              <dd className="mt-1.5 text-[15px]">{byLayer(l).map((f) => f.label).join(', ') || <span className="text-ink-muted">Nothing</span>}</dd>
            </div>
          ))}
          <div>
            <dt><PrivateBadge>Private note</PrivateBadge></dt>
            <dd className="mt-1.5 text-[15px] text-ink-muted">{c.private_note ? 'Saved. Never shared.' : 'None'}</dd>
          </div>
        </dl>
      </section>

      <ActionForm action={updatePolicyAction} className="card space-y-6 p-5">
        <input type="hidden" name="id" value={c.id} />
        <fieldset>
          <legend className="label">How long a share stays open</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DURATION_PRESETS.map((d) => (
              <label key={d.label} className="flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl border border-soft-300 px-3 has-[:checked]:border-electric has-[:checked]:bg-soft-100">
                <input type="radio" name="duration" value={d.minutes ?? 'none'} defaultChecked={p.duration_minutes === d.minutes} className="h-4 w-4 accent-electric" /> {d.label}
              </label>
            ))}
          </div>
          <p className="hint mt-2">You can always stop a share early, on any plan.</p>
        </fieldset>

        <label className="flex min-h-[48px] cursor-pointer items-start gap-3">
          <input type="checkbox" name="one_time" defaultChecked={p.one_time} className="mt-1 h-5 w-5 accent-electric" />
          <span><span className="font-semibold">Opens once</span><br /><span className="hint">Only the first person who taps to open can see it.</span></span>
        </label>

        <fieldset>
          <legend className="label">What they can do</legend>
          <div className="mt-2 space-y-2">
            {INTERACTION_LEVELS.map((l) => (
              <label key={l} className="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border border-soft-300 px-3 py-2 has-[:checked]:border-electric has-[:checked]:bg-soft-100">
                <input type="radio" name="interaction_level" value={l} defaultChecked={p.interaction_level === l} className="h-4 w-4 accent-electric" />
                <span><span className="font-semibold">{INTERACTION_COPY[l].label}</span><br /><span className="hint">{INTERACTION_COPY[l].hint}</span></span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex min-h-[48px] cursor-pointer items-start gap-3">
          <input type="checkbox" name="allow_expanded" defaultChecked={p.allow_expanded} disabled={!has(plan, 'disclosure.controls')} className="mt-1 h-5 w-5 accent-electric" />
          <span><span className="font-semibold">Offer “Learn more”</span><br /><span className="hint">{has(plan, 'disclosure.controls') ? 'Shows the details you placed on “Learn more” when they ask for them.' : 'Part of Pro.'}</span></span>
        </label>

        <Submit>Save rules</Submit>
      </ActionForm>
    </>
  )
}
