import Link from 'next/link'
import { CalendarCheck, CalendarDays, Home, Layers, LineChart, Settings, Users, UsersRound, QrCode } from 'lucide-react'
import { Logo } from './Logo'
import { NavLink } from './NavLink'
import { signOutAction } from '@/app/actions/auth'

const NAV = [
  { href: '/today', label: 'Today', icon: Home },
  { href: '/capsules', label: 'My Capsules', icon: Layers },
  { href: '/connections', label: 'Connections', icon: Users },
  { href: '/follow-ups', label: 'Follow-ups', icon: CalendarCheck },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/teams', label: 'Teams', icon: UsersRound },
  { href: '/insights', label: 'Insights', icon: LineChart },
  { href: '/settings', label: 'Settings', icon: Settings },
]

/** Calm workspace frame. Desktop: left rail. Phone: bottom bar with Share in the thumb zone. */
export function AppShell({ user, children }: { user: { display_name: string; plan_key: string }; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-soft-200 bg-white px-4 py-6 lg:flex">
        <Link href="/today" className="px-2"><Logo /></Link>
        {/* Plain anchors: the share shortcut starts a share, so it must never be prefetched. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- starts a share, so it must never be prefetched */}
        <a href="/share/quick" className="btn-share mt-8 w-full" data-testid="rail-share"><QrCode className="h-5 w-5" aria-hidden="true" /> Share now</a>
        <nav className="mt-6 flex-1 space-y-1" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.href} href={n.href} className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-ink-muted hover:bg-soft-100 hover:text-ink" activeClassName="!bg-soft-100 !text-navy-900 font-semibold">
              <n.icon className="h-5 w-5" aria-hidden="true" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-soft-200 pt-4">
          <p className="truncate px-3 text-sm font-semibold text-ink">{user.display_name}</p>
          <p className="px-3 text-xs capitalize text-ink-muted">{user.plan_key} plan</p>
          <form action={signOutAction}><button className="btn-quiet mt-2 w-full justify-start text-sm">Sign out</button></form>
        </div>
      </aside>

      <div className="pb-28 lg:pb-10">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-soft-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <Link href="/today"><Logo /></Link>
          <Link href="/settings" className="btn-quiet" aria-label="Settings"><Settings className="h-5 w-5" /></Link>
        </header>
        <main id="main" className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-soft-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Main">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5">
          <Tab href="/today" label="Today" icon={Home} />
          <Tab href="/capsules" label="Capsules" icon={Layers} />
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- starts a share, so it must never be prefetched */}
          <a href="/share/quick" className="-mt-6 flex flex-col items-center gap-1 pb-2" data-testid="tab-share">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-electric text-white shadow-lift ring-4 ring-white"><QrCode className="h-7 w-7" aria-hidden="true" /></span>
            <span className="text-[11px] font-semibold text-navy-900">Share</span>
          </a>
          <Tab href="/connections" label="People" icon={Users} />
          <Tab href="/more" label="More" icon={Settings} />
        </div>
      </nav>
    </div>
  )
}

function Tab({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Home }) {
  return (
    <NavLink href={href} className="flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium text-ink-muted" activeClassName="!text-electric-600 font-semibold">
      <Icon className="h-6 w-6" aria-hidden="true" />
      {label}
    </NavLink>
  )
}
