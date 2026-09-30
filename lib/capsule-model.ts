/** Shared (client + server) Identity Capsule vocabulary. */
export const MODES = ['professional', 'business', 'event', 'personal', 'social', 'creator', 'hiring', 'custom'] as const
export type Mode = (typeof MODES)[number]

export const MODE_COPY: Record<Mode, { label: string; hint: string }> = {
  professional: { label: 'Professional', hint: 'Conferences, meetings, introductions' },
  business: { label: 'Business', hint: 'A company, booth or counter' },
  event: { label: 'Event', hint: 'One event, with its own rules' },
  personal: { label: 'Personal', hint: 'A first name and one way to say hi' },
  social: { label: 'Social', hint: 'Parties, meetups, new friends' },
  creator: { label: 'Creator', hint: 'Your work and where to follow it' },
  hiring: { label: 'Hiring', hint: 'Roles you’re hiring for and how to apply' },
  custom: { label: 'Custom', hint: 'Start from a blank capsule' },
}

export const FIELD_KINDS = ['email', 'phone', 'website', 'social', 'booking', 'company', 'role', 'location', 'link', 'text'] as const
export type FieldKind = (typeof FIELD_KINDS)[number]
export const LAYERS = ['instant', 'expanded', 'hidden'] as const
export type Layer = (typeof LAYERS)[number]

export const LAYER_COPY: Record<Layer, { label: string; hint: string }> = {
  instant: { label: 'Shown first', hint: 'Anyone who opens it sees this' },
  expanded: { label: 'On “Learn more”', hint: 'Only if they choose to see more' },
  hidden: { label: 'Not shared', hint: 'Saved in your capsule, never shown' },
}

export const FIELD_KIND_COPY: Record<FieldKind, string> = {
  email: 'Email', phone: 'Phone', website: 'Website', social: 'Social profile', booking: 'Booking link',
  company: 'Company', role: 'Role', location: 'City or area', link: 'Link', text: 'Short text',
}

export interface CapsuleField { id: string; kind: FieldKind; label: string; value: string; layer: Layer }

export const INTERACTION_LEVELS = ['view', 'save', 'connect'] as const
export type InteractionLevel = (typeof INTERACTION_LEVELS)[number]
export const INTERACTION_COPY: Record<InteractionLevel, { label: string; hint: string }> = {
  view: { label: 'View only', hint: 'They can read it. Nothing else.' },
  save: { label: 'View and save', hint: 'They can save your details to their phone.' },
  connect: { label: 'Save or ask to connect', hint: 'They can also send you a request. You decide.' },
}

export const DURATION_PRESETS: { minutes: number | null; label: string }[] = [
  { minutes: 15, label: '15 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 60 * 24, label: '1 day' },
  { minutes: 60 * 24 * 7, label: '1 week' },
  { minutes: null, label: 'Until I stop it' },
]

/** Templates: sensible starting fields per mode. Values are blank — the user fills in only what they want. */
export const MODE_TEMPLATES: Record<Mode, { kind: FieldKind; label: string; layer: Layer }[]> = {
  professional: [
    { kind: 'role', label: 'Role', layer: 'instant' }, { kind: 'company', label: 'Company', layer: 'instant' },
    { kind: 'social', label: 'LinkedIn', layer: 'instant' }, { kind: 'email', label: 'Work email', layer: 'instant' },
    { kind: 'website', label: 'Website', layer: 'expanded' }, { kind: 'phone', label: 'Phone', layer: 'hidden' },
  ],
  business: [
    { kind: 'company', label: 'Company', layer: 'instant' }, { kind: 'booking', label: 'Book a meeting', layer: 'instant' },
    { kind: 'website', label: 'Website', layer: 'instant' }, { kind: 'email', label: 'Sales contact', layer: 'expanded' },
    { kind: 'location', label: 'Where to find us', layer: 'expanded' },
  ],
  event: [
    { kind: 'role', label: 'Role', layer: 'instant' }, { kind: 'company', label: 'Company', layer: 'instant' },
    { kind: 'email', label: 'Email', layer: 'expanded' }, { kind: 'social', label: 'Social', layer: 'expanded' },
  ],
  personal: [{ kind: 'social', label: 'Instagram', layer: 'instant' }, { kind: 'phone', label: 'Phone', layer: 'hidden' }],
  social: [{ kind: 'social', label: 'Social', layer: 'instant' }, { kind: 'location', label: 'City', layer: 'expanded' }],
  creator: [
    { kind: 'social', label: 'Main channel', layer: 'instant' }, { kind: 'link', label: 'Latest work', layer: 'instant' },
    { kind: 'email', label: 'Collaborations', layer: 'expanded' },
  ],
  hiring: [
    { kind: 'role', label: 'Role', layer: 'instant' }, { kind: 'company', label: 'Company', layer: 'instant' },
    { kind: 'link', label: 'Open roles', layer: 'instant' }, { kind: 'email', label: 'Recruiting email', layer: 'expanded' },
  ],
  custom: [],
}

export const CHANNELS = ['link', 'qr', 'web_share', 'nfc_tag', 'wallet_pass', 'shortcut', 'station'] as const
export type Channel = (typeof CHANNELS)[number]

export function hrefForField(f: { kind: FieldKind; value: string }): string | null {
  const v = f.value.trim()
  if (f.kind === 'email') return `mailto:${v}`
  if (f.kind === 'phone') return `tel:${v.replace(/[^\d+]/g, '')}`
  if (['website', 'social', 'booking', 'link'].includes(f.kind)) return /^https?:\/\//i.test(v) ? v : null
  return null
}

/** What a recipient is allowed to see. This is the only shape that ever leaves the server for recipients. */
export interface PublicCapsuleView {
  layer: 'instant' | 'expanded'
  mode: Mode
  modeLabel: string
  displayName: string
  headline: string
  message: string
  avatarUrl: string | null
  accent: string
  fields: Pick<CapsuleField, 'id' | 'kind' | 'label' | 'value'>[]
  primaryFieldId: string | null
  hasMore: boolean
  canSave: boolean
  canConnect: boolean
  expiresAt: string | null
  oneTime: boolean
  contextLabel: string | null
  eventName: string | null
}

