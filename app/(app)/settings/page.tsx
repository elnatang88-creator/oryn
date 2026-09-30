import Link from 'next/link'
import { ChevronRight, CreditCard, Lock, ShieldCheck, Shield } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const user = await requireUser()
  const items = [
    { href: '/settings/privacy', icon: Lock, title: 'Data & privacy', body: 'What’s shared, export, retention, delete account' },
    { href: '/settings/security', icon: ShieldCheck, title: 'Security', body: 'Password, signed-in devices and sessions' },
    { href: '/settings/plan', icon: CreditCard, title: 'Plan', body: `You’re on ${user.plan_key}` },
    ...(user.is_platform_admin ? [{ href: '/admin', icon: Shield, title: 'Admin console', body: 'Platform administration' }] : []),
  ]
  return (
    <>
      <PageHeader title="Settings" sub={user.email} />
      <ul className="card divide-y divide-soft-100">
        {items.map((i) => (
          <li key={i.href}><Link href={i.href} className="flex min-h-[64px] items-center gap-4 px-4 py-3 hover:bg-soft-50">
            <i.icon className="h-5 w-5 text-electric" aria-hidden="true" /><span className="flex-1"><span className="block font-semibold">{i.title}</span><span className="block text-sm text-ink-muted">{i.body}</span></span><ChevronRight className="h-5 w-5 text-ink-faint" aria-hidden="true" />
          </Link></li>
        ))}
      </ul>
    </>
  )
}
