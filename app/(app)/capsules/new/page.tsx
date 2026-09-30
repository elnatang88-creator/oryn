import { requireUser } from '@/lib/server/request'
import { getDb } from '@/lib/server/db'
import { has, userPlan } from '@/lib/server/plans'
import { templateFields, listCapsules } from '@/lib/server/services/capsules'
import { createCapsuleAction } from '@/app/actions/capsules'
import { CapsuleEditor } from '@/components/CapsuleEditor'
import { PageHeader, PlanGate } from '@/components/ui'
import { MODES, type Mode } from '@/lib/capsule-model'
import Link from 'next/link'
import { MODE_COPY } from '@/lib/capsule-model'
import { DEFAULT_DESIGN } from '@/lib/card-design'

export const metadata = { title: 'Create a capsule' }

export default async function NewCapsulePage({ searchParams }: { searchParams: Promise<{ mode?: string; first?: string }> }) {
  const sp = await searchParams
  const user = await requireUser()
  const db = await getDb()
  const plan = await userPlan(db, user.id)
  const existing = await listCapsules(user.id)
  const mode = (MODES as readonly string[]).includes(sp.mode ?? '') ? (sp.mode as Mode) : null

  if (existing.length >= 1 && !has(plan, 'capsules.multiple')) {
    return (<><PageHeader title="Create a capsule" /><PlanGate message="Your plan includes one capsule. Pro lets you keep a capsule for each kind of moment." /></>)
  }

  if (!mode) {
    return (
      <>
        <PageHeader title={sp.first ? 'Your first capsule' : 'Create a capsule'} sub="Where will you use it? You can change everything later." />
        <ul className="grid gap-3 sm:grid-cols-2">
          {MODES.map((m) => (
            <li key={m}>
              <Link href={`/capsules/new?mode=${m}${sp.first ? '&first=1' : ''}`} className="card flex min-h-[76px] flex-col justify-center px-5 py-4 hover:border-electric-400" data-testid={`mode-${m}`}>
                <span className="font-bold text-navy-900">{MODE_COPY[m].label}</span>
                <span className="text-sm text-ink-muted">{MODE_COPY[m].hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <>
      <PageHeader title={`New ${MODE_COPY[mode].label.toLowerCase()} capsule`} sub="Fill in only what you want. Choose where each detail appears." />
      <CapsuleEditor
        action={createCapsuleAction}
        submitLabel="Create capsule"
        canExpand={has(plan, 'disclosure.controls')}
        canNotes={has(plan, 'notes.private')}
        initial={{ name: MODE_COPY[mode].label, mode, display_name: user.display_name, headline: '', message: '', avatar_url: null, fields: templateFields(mode).map((f) => (!has(plan, 'disclosure.controls') && f.layer === 'expanded' ? { ...f, layer: 'instant' } : f)), primaryFieldId: null, private_note: '', design: mode === 'personal' || mode === 'social' ? { ...DEFAULT_DESIGN, material: 'pearl', foil: 'gold', finish: 'holo', layout: 'minimal' } : DEFAULT_DESIGN }}
      />
    </>
  )
}
