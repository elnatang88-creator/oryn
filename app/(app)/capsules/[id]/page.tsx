import Link from 'next/link'
import { notFound } from 'next/navigation'
import { QrCode, SlidersHorizontal } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { getDb } from '@/lib/server/db'
import { has, userPlan } from '@/lib/server/plans'
import { getCapsule } from '@/lib/server/services/capsules'
import { AppError } from '@/lib/server/errors'
import { archiveCapsuleAction, updateCapsuleAction } from '@/app/actions/capsules'
import { CapsuleEditor } from '@/components/CapsuleEditor'
import { PageHeader } from '@/components/ui'
import { normalizeDesign } from '@/lib/card-design'

export const metadata = { title: 'Edit capsule' }

export default async function EditCapsulePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const user = await requireUser()
  const res = await getCapsule(user.id, id).catch((e) => { if (e instanceof AppError) return null; throw e })
  if (!res) notFound()
  const { capsule: c } = res
  const plan = await userPlan(await getDb(), user.id)
  return (
    <>
      {sp.created && (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 border-electric/30 bg-soft-100 px-5 py-4" data-testid="created-banner">
          <p className="font-semibold text-navy-900">Your capsule is ready. Share it whenever you like.</p>
          <Link href={`/share?capsule=${c.id}`} className="btn-share"><QrCode className="h-5 w-5" aria-hidden="true" /> Share it</Link>
        </div>
      )}
      <PageHeader title={c.name} sub={`Version ${c.version}. Edits reach every open link right away.`} action={
        <div className="flex gap-2">
          <Link href={`/capsules/${c.id}/visibility`} className="btn-more"><SlidersHorizontal className="h-5 w-5" aria-hidden="true" /> Sharing rules</Link>
          {!sp.created && <Link href={`/share?capsule=${c.id}`} className="btn-share"><QrCode className="h-5 w-5" aria-hidden="true" /> Share</Link>}
        </div>
      } />
      <CapsuleEditor
        action={updateCapsuleAction}
        submitLabel="Save changes"
        canExpand={has(plan, 'disclosure.controls')}
        canNotes={has(plan, 'notes.private')}
        initial={{ id: c.id, name: c.name, mode: c.mode, display_name: c.display_name, headline: c.headline, message: c.message, avatar_url: c.avatar_url, fields: c.fields, primaryFieldId: c.primary_action?.fieldId ?? null, private_note: c.private_note, design: normalizeDesign(c.design) }}
      />
      <form action={archiveCapsuleAction} className="mt-10 border-t border-soft-200 pt-6">
        <input type="hidden" name="id" value={c.id} />
        <p className="text-sm text-ink-muted">Archiving stops every link to this capsule immediately.</p>
        <button className="btn-stop mt-3">Archive capsule</button>
      </form>
    </>
  )
}
