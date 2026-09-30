'use client'

import type { CSSProperties } from 'react'
import {
  BACK_LABELS, CARD_BACKS, CARD_FONTS, CARD_LAYOUTS, FINISHES, FINISH_LABELS, FOILS, FOIL_SPECS, FONT_SPECS, LAYOUT_LABELS, MATERIALS, MATERIAL_SPECS, PRESETS,
  designVars, type CardDesign,
} from '@/lib/card-design'

/** Everyone designs their own card: presets, then material, foil, finish, font, layout and what the back shows. */
export function CardDesigner({ value, onChange, initialsText }: { value: CardDesign; onChange: (d: CardDesign) => void; initialsText: string }) {
  const set = (patch: Partial<CardDesign>) => onChange({ ...value, ...patch })
  const same = (d: Omit<CardDesign, 'base' | 'back'>) => (Object.keys(d) as (keyof typeof d)[]).every((k) => d[k] === value[k])
  return (
    <div className="space-y-5" data-testid="card-designer">
      <div>
        <span className="label">Start from a design</span>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {PRESETS.map((p) => {
            const v = designVars({ ...p.design, base: value.base, back: value.back })
            return (
              <button key={p.id} type="button" onClick={() => set(p.design)} aria-pressed={same(p.design)} data-testid={`preset-${p.id}`}
                className={`rounded-xl border p-1.5 text-start text-[12px] font-semibold ${same(p.design) ? 'border-electric ring-2 ring-electric/25' : 'border-soft-300 bg-white'}`}>
                <span className="relative block aspect-[1.586] overflow-hidden rounded-lg" style={{ background: v['--mat'] }}>
                  <span className="lc-foil absolute bottom-1 start-2 text-[15px]" style={{ '--foil': v['--foil'], fontFamily: v['--card-font'], filter: v['--foil-shadow'] } as CSSProperties}>{initialsText}</span>
                </span>
                <span className="mt-1 block truncate">{p.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      <Choice label="Material" items={MATERIALS.map((m) => [m, MATERIAL_SPECS[m].label])} value={value.material} onPick={(m) => set({ material: m })}
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
