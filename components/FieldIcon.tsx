import { AtSign, Briefcase, CalendarClock, Globe, Link2, MapPin, Phone, Type, UserRound, Share2 } from 'lucide-react'
import type { FieldKind } from '@/lib/capsule-model'

const ICONS: Record<FieldKind, typeof Globe> = {
  email: AtSign, phone: Phone, website: Globe, social: Share2, booking: CalendarClock,
  company: Briefcase, role: UserRound, location: MapPin, link: Link2, text: Type,
}

export function FieldIcon({ kind, className = 'h-5 w-5' }: { kind: FieldKind; className?: string }) {
  const Icon = ICONS[kind] ?? Link2
  return <Icon className={className} aria-hidden="true" />
}
