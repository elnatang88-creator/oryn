'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2, Star } from 'lucide-react'
import { CapsuleView } from './CapsuleView'
import { ActionForm, Submit } from './Forms'
import { FieldIcon } from './FieldIcon'
import {
  FIELD_KINDS, FIELD_KIND_COPY, LAYER_COPY, MODES, MODE_COPY,
  type CapsuleField, type FieldKind, type Layer, type Mode, type PublicCapsuleView,
} from '@/lib/capsule-model'
import type { ActionState } from '@/app/actions/types'

export interface EditorValue {
  id?: string
  name: string
  mode: Mode
  display_name: string
  headline: string
  message: string
  avatar_url: string | null
  fields: CapsuleField[]
  primaryFieldId: string | null
  private_note: string
}

const fid = () => `f_${Math.random().toString(36).slice(2, 10)}`
const LAYERS: Layer[] = ['instant', 'expanded', 'hidden']

export function CapsuleEditor({
  initial, action, submitLabel, canExpand, canNotes,
}: {
  initial: EditorValue
  action: (s: ActionState, fd: FormData) => Promise<ActionState>
  submitLabel: string
  canExpand: boolean
  canNotes: boolean
}) {
  const [v, setV] = useState<EditorValue>(initial)
  const [previewLayer, setPreviewLayer] = useState<'instant' | 'expanded'>('instant')
  const set = <K extends keyof EditorValue>(k: K, val: EditorValue[K]) => setV((p) => ({ ...p, [k]: val }))
  const setField = (id: string, patch: Partial<CapsuleField>) => set('fields', v.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)))

  const view: PublicCapsuleView = useMemo(() => {
    const filled = v.fields.filter((f) => f.value.trim())
    const instant = filled.filter((f) => f.layer === 'instant')
    const expanded = canExpand ? filled.filter((f) => f.layer === 'expanded') : []
    return {
      layer: previewLayer, mode: v.mode, modeLabel: MODE_COPY[v.mode].label, displayName: v.display_name || 'Your name',
      headline: v.headline, message: v.message, avatarUrl: v.avatar_url, accent: 'blue',
      fields: (previewLayer === 'expanded' ? [...instant, ...expanded] : instant).map(({ id, kind, label, value }) => ({ id, kind, label, value })),
      primaryFieldId: v.primaryFieldId && instant.some((f) => f.id === v.primaryFieldId) ? v.primaryFieldId : null,
      hasMore: previewLayer === 'instant' && expanded.length > 0, canSave: true, canConnect: true,
      expiresAt: null, oneTime: false, contextLabel: null, eventName: null, isDemo: false,
    }
  }, [v, previewLayer, canExpand])

  const hiddenCount = v.fields.filter((f) => f.value && f.layer === 'hidden').length

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <ActionForm action={action} className="space-y-8">
        {v.id && <input type="hidden" name="id" value={v.id} />}
        <input type="hidden" name="fields" value={JSON.stringify(v.fields)} />
        <input type="hidden" name="primaryFieldId" value={v.primaryFieldId ?? ''} />
        <input type="hidden" name="mode" value={v.mode} />

        <fieldset className="card space-y-4 p-5">
          <legend className="sr-only">About this capsule</legend>
          <div>
            <label className="label" htmlFor="name">Capsule name <span className="font-normal text-ink-muted">— only you see this</span></label>
            <input dir="auto" id="name" name="name" className="input" value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Conference" maxLength={40} required />
          </div>
          <div>
            <span className="label">Mode</span>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Mode">
              {MODES.map((m) => (
                <button type="button" key={m} role="radio" aria-checked={v.mode === m} onClick={() => set('mode', m)}
                  className={`min-h-[40px] rounded-full border px-3.5 text-sm font-semibold ${v.mode === m ? 'border-electric bg-electric text-white' : 'border-soft-300 bg-white text-ink'}`}>
                  {MODE_COPY[m].label}
                </button>
              ))}
            </div>
            <p className="hint mt-1.5">{MODE_COPY[v.mode].hint}</p>
            {(v.mode === 'personal' || v.mode === 'social') && (
              <p className="mt-2 rounded-xl bg-soft-100 px-3 py-2 text-sm text-navy-900">Tip: for personal moments, share a first name and one way to say hi. New shares of this capsule end after a day unless you change it.</p>
            )}
          </div>
        </fieldset>

        <fieldset className="card space-y-4 p-5">
          <legend className="flex w-full items-center justify-between px-0 text-base font-bold text-navy-900">What they see first</legend>
          <div>
            <label className="label" htmlFor="display_name">Name they see</label>
            <input dir="auto" id="display_name" name="display_name" className="input" value={v.display_name} onChange={(e) => set('display_name', e.target.value)} maxLength={60} autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="headline">One line about you <span className="font-normal text-ink-muted">(optional)</span></label>
            <input dir="auto" id="headline" name="headline" className="input" value={v.headline} onChange={(e) => set('headline', e.target.value)} maxLength={90} placeholder="Product lead · Harbor Labs" />
          </div>
          <div>
            <label className="label" htmlFor="message">A short message <span className="font-normal text-ink-muted">(optional)</span></label>
            <textarea dir="auto" id="message" name="message" className="input min-h-[80px] py-3" value={v.message} onChange={(e) => set('message', e.target.value)} maxLength={160} placeholder="Didn’t want to interrupt — here’s how to reach me." />
          </div>
          <div>
            <label className="label" htmlFor="avatar_url">Photo link <span className="font-normal text-ink-muted">(optional, https)</span></label>
            <input dir="auto" id="avatar_url" name="avatar_url" className="input" value={v.avatar_url ?? ''} onChange={(e) => set('avatar_url', e.target.value || null)} placeholder="https://…" inputMode="url" />
          </div>
        </fieldset>

        <fieldset className="card p-5">
          <legend className="text-base font-bold text-navy-900">Details — you choose where each one appears</legend>
          <p className="hint mt-1">Empty details are never shared.</p>
          <ul className="mt-4 space-y-3">
            {v.fields.map((f) => (
              <li key={f.id} className="rounded-2xl border border-soft-200 p-3" data-testid="field-row">
                <div className="flex items-center gap-2">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-soft-100 text-electric-600"><FieldIcon kind={f.kind} /></span>
                  <input dir="auto" aria-label="Label" className="input mt-0 min-h-[44px] flex-1 font-semibold" value={f.label} onChange={(e) => setField(f.id, { label: e.target.value })} maxLength={40} />
                  <button type="button" onClick={() => set('primaryFieldId', v.primaryFieldId === f.id ? null : f.id)} className={`grid h-11 w-11 place-items-center rounded-xl ${v.primaryFieldId === f.id ? 'bg-electric text-white' : 'text-ink-faint hover:bg-soft-100'}`} aria-pressed={v.primaryFieldId === f.id} aria-label="Make this the main button">
                    <Star className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => set('fields', v.fields.filter((x) => x.id !== f.id))} className="grid h-11 w-11 place-items-center rounded-xl text-ink-faint hover:bg-red-50 hover:text-signal-stop" aria-label={`Remove ${f.label}`}>
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                <input dir="auto" aria-label={`${f.label} value`} className="input" value={f.value} onChange={(e) => setField(f.id, { value: e.target.value })} placeholder={placeholder(f.kind)} inputMode={f.kind === 'email' ? 'email' : f.kind === 'phone' ? 'tel' : ['website', 'social', 'booking', 'link'].includes(f.kind) ? 'url' : 'text'} data-testid={`field-value-${f.kind}`} />
                <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-soft-100 p-1" role="radiogroup" aria-label={`Where “${f.label}” appears`}>
                  {LAYERS.map((l) => {
                    const disabled = l === 'expanded' && !canExpand
                    return (
                      <button type="button" key={l} role="radio" aria-checked={f.layer === l} disabled={disabled} onClick={() => setField(f.id, { layer: l })}
                        data-testid={`layer-${f.kind}-${l}`}
                        className={`min-h-[40px] rounded-lg px-1 text-[13px] font-semibold ${f.layer === l ? (l === 'hidden' ? 'bg-navy-900 text-white' : 'bg-white text-navy-900 shadow-sm') : 'text-ink-muted'} disabled:opacity-40`}>
                        {LAYER_COPY[l].label}
                      </button>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
          {!canExpand && <p className="mt-3 text-sm text-ink-muted">“On Learn more” is part of Pro. <a className="font-semibold text-electric-600" href="/settings/plan">See plans</a></p>}
          <AddField onAdd={(kind) => set('fields', [...v.fields, { id: fid(), kind, label: FIELD_KIND_COPY[kind], value: '', layer: 'instant' }])} />
        </fieldset>

        <fieldset className="card space-y-3 border-navy-900/20 bg-navy-900 p-5 text-white">
          <legend className="sr-only">Private note</legend>
          <div className="flex items-center justify-between">
            <label htmlFor="private_note" className="text-base font-bold">Private note</label>
            <span className="chip bg-white/15 text-white">Only you</span>
          </div>
          <p className="text-sm text-soft-200">Never shown to anyone you share with.</p>
          <textarea dir="auto" id="private_note" name="private_note" disabled={!canNotes} className="input min-h-[80px] border-white/20 bg-navy-800 py-3 text-white placeholder:text-soft-300/60" value={v.private_note} onChange={(e) => set('private_note', e.target.value)} maxLength={2000} placeholder={canNotes ? 'When to use this capsule, what to keep hidden…' : 'Private notes are part of Pro.'} />
        </fieldset>

        <div className="sticky bottom-24 z-10 rounded-2xl bg-soft-50/90 py-2 backdrop-blur lg:bottom-4">
          {hiddenCount > 0 && <p className="mb-2 text-center text-sm text-ink-muted">{hiddenCount} detail{hiddenCount === 1 ? '' : 's'} saved but not shared.</p>}
          <Submit>{submitLabel}</Submit>
        </div>
      </ActionForm>

      <aside className="lg:sticky lg:top-8 lg:self-start" aria-label="Preview">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-navy-900">What they’ll see</p>
          <div className="flex rounded-xl bg-soft-100 p-1 text-[13px] font-semibold">
            <button type="button" onClick={() => setPreviewLayer('instant')} className={`min-h-[36px] rounded-lg px-3 ${previewLayer === 'instant' ? 'bg-white shadow-sm' : 'text-ink-muted'}`}>First view</button>
            <button type="button" onClick={() => setPreviewLayer('expanded')} className={`min-h-[36px] rounded-lg px-3 ${previewLayer === 'expanded' ? 'bg-white shadow-sm' : 'text-ink-muted'}`}>Learn more</button>
          </div>
        </div>
        <CapsuleView view={view} preview />
      </aside>
    </div>
  )
}

function placeholder(kind: FieldKind) {
  return { email: 'you@company.com', phone: '+1 555 000 0000', website: 'yoursite.com', social: 'instagram.com/you', booking: 'cal.com/you', company: 'Company name', role: 'What you do', location: 'City', link: 'https://…', text: 'Anything short' }[kind]
}

function AddField({ onAdd }: { onAdd: (k: FieldKind) => void }) {
  const [open, setOpen] = useState(false)
  if (!open) return <button type="button" className="btn-more mt-4 w-full" onClick={() => setOpen(true)}><Plus className="h-5 w-5" aria-hidden="true" /> Add a detail</button>
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {FIELD_KINDS.map((k) => (
        <button type="button" key={k} className="btn-more min-h-[44px] justify-start text-sm" onClick={() => { onAdd(k); setOpen(false) }}>
          <FieldIcon kind={k} className="h-4 w-4 text-electric-600" /> {FIELD_KIND_COPY[k]}
        </button>
      ))}
    </div>
  )
}
