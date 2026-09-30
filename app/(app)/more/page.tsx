import Link from 'next/link'
import { CalendarCheck, CalendarDays, ChevronRight, LineChart, QrCode, Settings, UsersRound } from 'lucide-react'
import { signOutAction } from '@/app/actions/auth'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'More' }

const ITEMS = [
  { href: '/follow-ups', label: 'Follow-ups', icon: CalendarCheck },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/teams', label: 'Teams', icon: UsersRound },
  { href: '/stations', label: 'Stations & QR codes', icon: QrCode },
  { href: '/insights', label: 'Insights', icon: LineChart },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function MorePage() {
  return (
    <>
      <PageHeader title="More" />
      <ul className="card divide-y divide-soft-100">
        {ITEMS.map((i) => (
          <li key={i.href}><Link href={i.href} className="flex min-h-[60px] items-center gap-4 px-4 hover:bg-soft-50"><i.icon className="h-5 w-5 text-electric" aria-hidden="true" /><span className="flex-1 font-semibold">{i.label}</span><ChevronRight className="h-5 w-5 text-ink-faint" aria-hidden="true" /></Link></li>
        ))}
      </ul>
      <form action={signOutAction} className="mt-6"><button className="btn-more w-full">Sign out</button></form>
    </>
  )
}
