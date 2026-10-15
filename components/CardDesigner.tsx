'use client'

import { useState, type CSSProperties } from 'react'
import { ImagePlus, X } from 'lucide-react'
import {
  BACK_LABELS, CARD_BACKS, CARD_FONTS, CARD_LAYOUTS, FINISHES, FINISH_LABELS, FOILS, FOIL_SPECS, FONT_SPECS, LAYOUT_LABELS, MATERIALS, MATERIAL_SPECS, PRESETS, EXTRA_MATERIALS,
  designVars, isValidLogo, LOGO_MAX_CHARS, type CardDesign,
} from '@/lib/card-design'

/** Everyone designs their own card: presets, then material, foil, finish, font, layout and what the back shows. */
export function CardDesigner({ value, onChange, initialsText }: { value: CardDesign; onChange: (d: CardDesign) => void; initialsText: string }) {
  const set = (patch: Partial<CardDesign>) => onChange({ ...value, ...patch })
  const same = (d: Omit<CardDesign, 'base' | 'back'>) => (Object.keys(d) as (keyof typeof d)[]).every((k) => d[k] === value[k])
  return (
    <div className="space-y-5" data-testid="card-designer">
      <div>
        <span className="label">Collection</span>
        <p className="hint">Seven looks, each fully editable below.</p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="collections">
          {PRESETS.map((p) => {
            const v = designVars({ ...p.design, base: value.base, back: value.back })
            return (
              <button key={p.id} type="button" onClick={() => set(p.design)} aria-pressed={same(p.design)} data-testid={`preset-${p.id}`}
                className={`rounded-xl border p-1.5 text-start text-[12px] font-semibold ${same(p.design) ? 'border-electric ring-2 ring-electric/25' : 'border-soft-300 bg-white'}`}>
                <span className="relative block aspect-[1.586] overflow-hidden rounded-lg" style={{ background: v['--mat'] }}>
                  <span className="lc-foil absolute bottom-1 start-2 text-[15px]" style={{ '--foil': v['--foil'], fontFamily: v['--card-font'], filter: v['--foil-shadow'] } as CSSProperties}>{initialsText}</span>
                </span>
                <span className="mt-1 block truncate"><span className="text-ink-faint">{p.letter}</span> · {p.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      <Choice label="Material" items={MATERIALS.filter((m) => !EXTRA_MATERIALS.includes(m) || m === value.material).map((m) => [m, MATERIAL_SPECS[m].label])} value={value.material} onPick={(m) => set({ material: m })}
        swatch={(m) => (m === 'custom' ? value.base : MATERIAL_SPECS[m].bg!)} testid="material" />
      {value.material === 'custom' && (
        <label className="inline-flex min-h-[44px] items-center gap-3 rounded-xl border border-soft-300 bg-white px-3 text-sm font-semibold">
          Card colour <input type="color" value={value.base} onChange={(e) => set({ base: e.target.value })} className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0" aria-label="Card colour" />
        </label>
      )}
      <Choice label="Foil" items={FOILS.map((f) => [f, FOIL_SPECS[f].label])} value={value.foil} onPick={(f) => set({ foil: f })} swatch={(f) => FOIL_SPECS[f].g} round testid="foil" />
      <Choice label="Finish" items={FINISHES.map((f) => [f, FINISH_LABELS[f]])} value={value.finish} onPick={(f) => set({ finish: f })} testid="finish" />
      <Choice label="Lettering" items={CARD_FONTS.map((f) => [f, FONT_SPECS[f].label])} value={value.font} onPick={(f) => set({ font: f })} font={(f) => FONT_SPECS[f].family} testid="font" />
      <Choice label="Layout" items={CARD_LAYOUTS.map((l) => [l, LAYOUT_LABELS[l]])} value={value.layout} onPick={(l) => set({ layout: l })} testid="layout" />
      <Choice label="Back of the card" items={CARD_BACKS.map((b) => [b, BACK_LABELS[b]])} value={value.back} onPick={(b) => set({ back: b })} testid="back" />
      <LogoPicker value={value.logo ?? null} onChange={(logo) => set({ logo })} />
    </div>
  )
}

function Choice<T extends string>({ label, items, value, onPick, swatch, round, font, testid }: {
  label: string; items: [T, string][]; value: T; onPick: (v: T) => void; swatch?: (v: T) => string; round?: boolean; font?: (v: T) => string; testid: string
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {items.map(([id, text]) => (
          <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => onPick(id)} data-testid={`${testid}-${id}`}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${value === id ? 'border-electric bg-soft-100 ring-2 ring-electric/20' : 'border-soft-300 bg-white'}`}
            style={font ? { fontFamily: font(id) } : undefined}>
            {swatch && <span className={`h-6 w-6 shrink-0 ${round ? 'rounded-full' : 'rounded-md'} shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)]`} style={{ background: swatch(id) }} />}
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Logo: resized on the device (max 192 px, PNG or JPEG) to a small data URL that lives inside the design, so it
 * renders on every surface — including the public card without JavaScript — and needs no file storage.
 */
export async function shrinkImage(file: File, max = 192, limit = LOGO_MAX_CHARS): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) throw new Error('Choose a PNG, JPEG, WebP or SVG image.')
  if (file.size > 8 * 1024 * 1024) throw new Error('That image is over 8 MB.')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That file isn’t an image we can read.')); i.src = url })
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale))
    const c = document.createElement('canvas'); c.width = w; c.height = h
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    let out = c.toDataURL('image/png')
    if (out.length > limit) out = c.toDataURL('image/jpeg', 0.82)
    if (out.length > limit) throw new Error('That image is too detailed for a card logo. Try a simpler one.')
    return out
  } finally { URL.revokeObjectURL(url) }
}

function LogoPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <fieldset data-testid="logo-picker">
      <legend className="label">Logo <span className="font-normal text-ink-muted">(optional) — replaces the ORYN mark on the card</span></legend>
      <div className="mt-2 flex items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-soft-300 bg-soft-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value} alt="Your logo" className="h-12 w-12 object-contain" data-testid="logo-preview" /> : <ImagePlus className="h-6 w-6 text-ink-faint" aria-hidden="true" />}
        </span>
        <label className="btn-more min-h-[44px] cursor-pointer px-4 text-sm">
          {busy ? 'Preparing…' : value ? 'Replace logo' : 'Upload logo'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" data-testid="logo-file" disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = ''
              if (!f) return
              setBusy(true); setErr(null)
              try { const d = await shrinkImage(f); if (!isValidLogo(d)) throw new Error('That image could not be prepared.'); onChange(d) } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
            }} />
        </label>
        {value && <button type="button" onClick={() => onChange(null)} className="btn-quiet min-h-[44px] text-sm" data-testid="logo-remove"><X className="h-4 w-4" aria-hidden="true" /> Remove</button>}
      </div>
      {err && <p className="mt-2 text-sm font-medium text-signal-stop" role="alert">{err}</p>}
      <p className="hint mt-1">Stays small (under 90 KB) and lives inside your card. Square or wide marks look best.</p>
    </fieldset>
  )
}
