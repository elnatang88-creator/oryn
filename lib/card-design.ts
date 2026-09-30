/**
 * ORYN card design system (shared by server and client).
 * A capsule's card is described by a small, validated design object; all visuals are pure CSS
 * (gradients + inline SVG textures) and self-hosted fonts — no images or third-party assets.
 */

export const MATERIALS = ['obsidian', 'midnight', 'pearl', 'carbon', 'marble', 'titanium', 'custom'] as const
export const FOILS = ['gold', 'rosegold', 'champagne', 'silver', 'electric', 'graphite', 'ivory'] as const
export const FINISHES = ['matte', 'foil', 'holo'] as const
export const CARD_FONTS = ['classic', 'editorial', 'modern', 'bold'] as const
export const CARD_LAYOUTS = ['monogram', 'signature', 'minimal', 'photo'] as const
/** What the back of the card shows: a code that opens the card, or the ORYN mark only (no code). */
export const CARD_BACKS = ['qr', 'brand'] as const

export type Material = (typeof MATERIALS)[number]
export type Foil = (typeof FOILS)[number]
export type Finish = (typeof FINISHES)[number]
export type CardFont = (typeof CARD_FONTS)[number]
export type CardLayout = (typeof CARD_LAYOUTS)[number]
export type CardBackKind = (typeof CARD_BACKS)[number]

export interface CardDesign { material: Material; foil: Foil; finish: Finish; font: CardFont; layout: CardLayout; base: string; back: CardBackKind }

export const DEFAULT_DESIGN: CardDesign = { material: 'obsidian', foil: 'gold', finish: 'foil', font: 'classic', layout: 'monogram', base: '#0f3d2e', back: 'qr' }
export const BACK_LABELS: Record<CardBackKind, string> = { qr: 'Code to open my card', brand: 'ORYN mark only' }

const svg = (body: string, w = 300, h = 300) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`)}")`
const noise = (freq: number, alpha: number) => svg(`<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ${alpha} 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/>`)
const marble = `${svg(`<filter id='m' x='0' y='0'><feTurbulence type='turbulence' baseFrequency='0.0045 0.016' numOctaves='6' seed='23'/><feColorMatrix type='matrix' values='0 0 0 0 0.32  0 0 0 0 0.31  0 0 0 0 0.30  -6 0 0 0 1.35'/></filter><rect width='100%' height='100%' fill='#f5f3ef'/><rect width='100%' height='100%' filter='url(#m)' opacity='0.55'/>`, 640, 404)} center / cover`

interface MaterialSpec { label: string; bg?: string; texture: string; blend: string; ink: string; foil: Foil; sheen: number; shadow?: string }
export const MATERIAL_SPECS: Record<Material, MaterialSpec> = {
  obsidian: { label: 'Obsidian', bg: 'radial-gradient(120% 90% at 18% 0%, #2a2a31 0%, #0d0d10 55%, #050506 100%)', texture: noise(0.9, 0.09), blend: 'overlay', ink: 'rgba(255,255,255,.74)', foil: 'gold', sheen: 0.22 },
  midnight: { label: 'Midnight', bg: 'radial-gradient(120% 100% at 15% 0%, #1a3a92 0%, #011441 55%, #000a24 100%)', texture: noise(0.9, 0.08), blend: 'overlay', ink: 'rgba(222,231,255,.78)', foil: 'silver', sheen: 0.24 },
  pearl: { label: 'Pearl', bg: 'linear-gradient(125deg,#fdfcf9 0%,#efe8dc 32%,#fbf9f4 52%,#e7ded0 78%,#f7f3ec 100%)', texture: 'linear-gradient(115deg, rgba(255,210,230,.35), rgba(190,225,255,.35) 40%, rgba(255,240,200,.35) 70%, rgba(210,200,255,.35))', blend: 'soft-light', ink: 'rgba(52,44,32,.72)', foil: 'gold', sheen: 0.5, shadow: 'drop-shadow(0 .12cqw 0 rgba(90,70,30,.35))' },
  carbon: { label: 'Carbon', bg: 'repeating-linear-gradient(45deg, rgba(255,255,255,.045) 0 2px, transparent 2px 7px), repeating-linear-gradient(-45deg, rgba(0,0,0,.45) 0 2px, transparent 2px 7px), linear-gradient(135deg,#23252a,#0e0f12)', texture: noise(1.2, 0.06), blend: 'overlay', ink: 'rgba(235,240,255,.72)', foil: 'electric', sheen: 0.2 },
  marble: { label: 'Marble', bg: marble, texture: 'linear-gradient(120deg, rgba(255,255,255,.4), transparent 60%)', blend: 'soft-light', ink: 'rgba(25,22,20,.72)', foil: 'gold', sheen: 0.45, shadow: 'drop-shadow(0 .12cqw 0 rgba(60,45,20,.4))' },
  titanium: { label: 'Titanium', bg: 'repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0 1px, rgba(0,0,0,.05) 1px 2px, transparent 2px 4px), linear-gradient(135deg,#676b72 0%,#c9ccd1 42%,#8b8f96 70%,#55595f 100%)', texture: noise(0.7, 0.06), blend: 'overlay', ink: 'rgba(18,20,24,.8)', foil: 'graphite', sheen: 0.4, shadow: 'drop-shadow(0 .12cqw 0 rgba(255,255,255,.35))' },
  custom: { label: 'Your colour', texture: noise(0.9, 0.07), blend: 'overlay', ink: 'rgba(255,255,255,.78)', foil: 'gold', sheen: 0.28 },
}

export const FOIL_SPECS: Record<Foil, { label: string; g: string }> = {
  gold: { label: 'Gold', g: 'linear-gradient(115deg,#7a5a17 0%,#e9d18a 20%,#b8913a 38%,#fff1c1 50%,#a67c2d 64%,#e6c877 82%,#7a5a17 100%)' },
  rosegold: { label: 'Rose gold', g: 'linear-gradient(115deg,#7a433e 0%,#f2c6b6 20%,#b5776c 38%,#ffe3d8 50%,#9d5e57 64%,#e8b3a3 82%,#7a433e 100%)' },
  champagne: { label: 'Champagne', g: 'linear-gradient(115deg,#8a7148 0%,#f3e6c4 20%,#c4a878 38%,#fff7e2 50%,#a88b5c 64%,#ead8b0 82%,#8a7148 100%)' },
  silver: { label: 'Silver', g: 'linear-gradient(115deg,#6f747a 0%,#eef1f4 20%,#a9aeb4 38%,#ffffff 50%,#8c9197 64%,#dfe3e7 82%,#6f747a 100%)' },
  electric: { label: 'ORYN blue', g: 'linear-gradient(115deg,#002a8a 0%,#86aaff 20%,#0053fd 38%,#d6e2ff 50%,#0046d6 64%,#5c8dff 82%,#002a8a 100%)' },
  graphite: { label: 'Graphite', g: 'linear-gradient(115deg,#0a0b0d 0%,#44474d 25%,#15171a 45%,#5a5e65 55%,#101114 75%,#2d3035 100%)' },
  ivory: { label: 'White', g: 'linear-gradient(115deg,#d8dbe0 0%,#ffffff 30%,#eceef2 55%,#ffffff 75%,#d8dbe0 100%)' },
}

export const FINISH_LABELS: Record<Finish, string> = { matte: 'Matte', foil: 'Foil', holo: 'Holographic' }

export const FONT_SPECS: Record<CardFont, { label: string; family: string; weight: number; track: string }> = {
  classic: { label: 'Classic', family: '"Bellefair", "Frank Ruhl Libre", Georgia, serif', weight: 400, track: '.04em' },
  editorial: { label: 'Editorial', family: '"Frank Ruhl Libre", "Bellefair", Georgia, serif', weight: 700, track: '0' },
  modern: { label: 'Modern', family: '"Heebo", "Arial Hebrew", system-ui, sans-serif', weight: 800, track: '-.01em' },
  bold: { label: 'Bold', family: '"Secular One", "Heebo", system-ui, sans-serif', weight: 400, track: '.01em' },
}

export const LAYOUT_LABELS: Record<CardLayout, string> = { monogram: 'Monogram', signature: 'Signature', minimal: 'Minimal', photo: 'Photo' }

export const PRESETS: { id: string; label: string; design: Omit<CardDesign, 'base' | 'back'> }[] = [
  { id: 'black', label: 'Black', design: { material: 'obsidian', foil: 'gold', finish: 'foil', font: 'classic', layout: 'monogram' } },
  { id: 'navy', label: 'Navy Signature', design: { material: 'midnight', foil: 'silver', finish: 'foil', font: 'editorial', layout: 'signature' } },
  { id: 'pearl', label: 'Pearl', design: { material: 'pearl', foil: 'gold', finish: 'holo', font: 'classic', layout: 'minimal' } },
  { id: 'carbon', label: 'Carbon', design: { material: 'carbon', foil: 'electric', finish: 'foil', font: 'modern', layout: 'signature' } },
  { id: 'marble', label: 'Marble', design: { material: 'marble', foil: 'gold', finish: 'matte', font: 'editorial', layout: 'monogram' } },
  { id: 'titanium', label: 'Titanium', design: { material: 'titanium', foil: 'graphite', finish: 'matte', font: 'modern', layout: 'minimal' } },
]

const HEX = /^#[0-9a-f]{6}$/i

/** Coerces anything (stored JSON, form input) into a valid design. Unknown values fall back to defaults. */
export function normalizeDesign(input: unknown): CardDesign {
  const d = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const pick = <T extends string>(v: unknown, allowed: readonly T[], def: T): T => (allowed.includes(v as T) ? (v as T) : def)
  return {
    material: pick(d.material, MATERIALS, DEFAULT_DESIGN.material),
    foil: pick(d.foil, FOILS, DEFAULT_DESIGN.foil),
    finish: pick(d.finish, FINISHES, DEFAULT_DESIGN.finish),
    font: pick(d.font, CARD_FONTS, DEFAULT_DESIGN.font),
    layout: pick(d.layout, CARD_LAYOUTS, DEFAULT_DESIGN.layout),
    base: typeof d.base === 'string' && HEX.test(d.base) ? d.base.toLowerCase() : DEFAULT_DESIGN.base,
    back: pick(d.back, CARD_BACKS, DEFAULT_DESIGN.back),
  }
}

export function isValidDesign(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false
  const d = input as Record<string, unknown>
  return MATERIALS.includes(d.material as Material) && FOILS.includes(d.foil as Foil) && FINISHES.includes(d.finish as Finish)
    && CARD_FONTS.includes(d.font as CardFont) && CARD_LAYOUTS.includes(d.layout as CardLayout) && (d.base === undefined || (typeof d.base === 'string' && HEX.test(d.base)))
    && (d.back === undefined || CARD_BACKS.includes(d.back as CardBackKind))
}

function rgb(hex: string): [number, number, number] { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
function mix([r, g, b]: [number, number, number], f: number) { const t = f < 0 ? 0 : 255, p = Math.abs(f); return `rgb(${Math.round((t - r) * p + r)},${Math.round((t - g) * p + g)},${Math.round((t - b) * p + b)})` }
function luminance([r, g, b]: [number, number, number]) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 }

/** CSS custom properties for a card. Values come only from the fixed tables above (or a validated hex). */
export function designVars(design: CardDesign): Record<string, string> {
  const m = MATERIAL_SPECS[design.material]
  let bg = m.bg ?? '', ink = m.ink, shadow = m.shadow ?? 'none'
  if (design.material === 'custom') {
    const c = rgb(design.base)
    bg = `radial-gradient(120% 100% at 15% 0%, ${mix(c, 0.28)} 0%, ${design.base} 52%, ${mix(c, -0.55)} 100%)`
    const light = luminance(c) > 0.6
    ink = light ? 'rgba(20,20,24,.75)' : 'rgba(255,255,255,.78)'
    if (light) shadow = 'drop-shadow(0 .12cqw 0 rgba(0,0,0,.3))'
  }
  const f = FONT_SPECS[design.font]
  return {
    '--mat': bg, '--texture': m.texture, '--texture-blend': m.blend, '--ink-card': ink, '--foil': FOIL_SPECS[design.foil].g,
    '--foil-shadow': shadow, '--card-font': f.family, '--name-weight': String(f.weight), '--name-track': f.track, '--sheen': String(m.sheen),
  }
}

export function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]).join('') || '•'
}
