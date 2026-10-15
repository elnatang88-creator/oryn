import Link from 'next/link'
import { Briefcase, CalendarCheck, CalendarDays, Home, Layers, LineChart, Settings, Users, UsersRound } from 'lucide-react'
import { ExchangeCardsIcon } from './OrynIcons'
import { CommandMenu, SearchButton } from './CommandMenu'
import { Logo } from './Logo'
import { NavLink } from './NavLink'
import { NotificationBell } from './NotificationBell'
import { signOutAction } from '@/app/actions/auth'

const NAV = [
  { href: '/today', label: 'Today', icon: Home },
  { href: '/capsules', label: 'My cards', icon: Layers },
  { href: '/connections', label: 'People', icon: Users },
  { href: '/follow-ups', label: 'Follow-ups', icon: CalendarCheck },
  { href: '/business', label: 'Business', icon: Briefcase },
  { href: '/events', label: 'Events', icon: CalendarDays },
  { href: '/teams', label: 'Teams', icon: UsersRound },
  { href: '/insights', label: 'Insights', icon: LineChart },
  { href: '/settings', label: 'Settings', icon: Settings },
]

/** Calm workspace frame. Desktop: left rail. Phone: bottom bar with Share in the thumb zone. */
export function AppShell({ user, unread = 0, children }: { user: { display_name: string; plan_key: string; email: string; email_verified_at?: Date | null }; unread?: number; children: React.ReactNode }) {
  const demo = user.email.endsWith('@oryn.local')
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-soft-200 bg-white px-4 py-6 lg:flex">
        <Link href="/today" className="px-2"><Logo /></Link>
        {/* Plain anchors: the share shortcut starts a share, so it must never be prefetched. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- starts a share, so it must never be prefetched */}
        <a href="/share/quick" className="btn-share mt-8 w-full" data-testid="rail-share"><ExchangeCardsIcon className="h-5 w-5" /> Share my card</a>
        <div className="mt-4"><SearchButton /></div>
        <nav className="mt-4 flex-1 space-y-1" aria-label="Main">
          <NotificationBell initial={unread} />
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
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-soft-200/80 bg-white/85 px-4 shadow-[0_1px_0_rgba(255,255,255,.6)_inset] backdrop-blur-xl lg:hidden">
          <Link href="/today"><Logo /></Link>
          <span className="flex items-center gap-1"><SearchButton compact /><NotificationBell initial={unread} compact /><Link href="/settings" className="btn-quiet" aria-label="Settings"><Settings className="h-5 w-5" /></Link></span>
        </header>
        {demo && <p className="bg-navy-900 px-4 py-2 text-center text-xs font-semibold text-soft-200" role="note" data-testid="demo-banner">Demo account · all people, requests and numbers here are fictional sample data</p>}
        {!demo && user.email_verified_at === null && <p className="bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-900" role="note" data-testid="verify-banner">Confirm your email to secure your account. <Link href="/settings/security" className="underline">Resend the link</Link></p>}
        <main id="main" className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-10">{children}</main>
      </div>

      <CommandMenu />
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-soft-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_-24px_rgba(7,19,43,.5)] backdrop-blur-xl lg:hidden" aria-label="Main">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5">
          <Tab href="/today" label="Today" icon={Home} />
          <Tab href="/capsules" label="Cards" icon={Layers} />
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- starts a share, so it must never be prefetched */}
          <a href="/share/quick" className="-mt-6 flex flex-col items-center gap-1 pb-2" data-testid="tab-share">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[#1f6bff] to-[#0038b8] text-white shadow-lift ring-4 ring-white"><ExchangeCardsIcon className="h-8 w-8" /></span>
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
    <NavLink href={href} className="tab group flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-ink-muted transition-colors" activeClassName="tab-active !text-navy-900 font-semibold">
      <span className="tab-icon grid h-8 w-12 place-items-center rounded-full transition-all"><Icon className="h-[22px] w-[22px]" aria-hidden="true" /></span>
      {label}
    </NavLink>
  )
}
