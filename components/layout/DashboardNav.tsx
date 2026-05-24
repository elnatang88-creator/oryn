'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, CreditCard, BarChart3, Users, Settings,
  LogOut, Shield, ChevronRight, Menu, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { Profile } from '@/types'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/card', label: 'My Card', icon: CreditCard },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/leads', label: 'Leads', icon: Users },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

interface DashboardNavProps {
  profile: Profile | null
  isAdmin?: boolean
}

export function DashboardNav({ profile, isAdmin }: DashboardNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-obsidian-border/50">
        <span className="font-display text-xl tracking-[0.25em] gold-text">ORYN</span>
        <p className="text-xs text-cream/30 mt-0.5 tracking-wider">Premium Identity</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto scrollbar-none">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}
              className={cn('nav-item', active && 'active')}
            >
              <Icon size={16} />
              <span>{label}</span>
              {active && <ChevronRight size={12} className="ml-auto opacity-50" />}
            </Link>
          )
        })}

        {isAdmin && (
          <Link href="/admin" onClick={() => setMobileOpen(false)}
            className={cn('nav-item mt-4', pathname.startsWith('/admin') && 'active')}
          >
            <Shield size={16} />
            <span>Admin</span>
          </Link>
        )}
      </nav>

      {/* User section */}
      <div className="px-3 pb-6 border-t border-obsidian-border/50 pt-4 space-y-2">
        <div className="flex items-center gap-3 px-4 py-3 rounded-chip bg-obsidian-raised">
          <div className="w-8 h-8 rounded-full bg-gold/15 border border-gold/20 flex items-center justify-center text-gold text-xs font-display font-semibold shrink-0">
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-cream/90 truncate">{profile?.full_name || 'User'}</p>
            <p className="text-xs text-cream/40 truncate">@{profile?.username}</p>
          </div>
        </div>

        <button onClick={handleSignOut}
          className="nav-item w-full text-cream/40 hover:text-red-400"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 border-r border-obsidian-border/50 bg-obsidian-soft">
        <NavContent />
      </aside>

      {/* Mobile toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-chip bg-obsidian-card border border-obsidian-border text-cream/60"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-60 bg-obsidian-soft border-r border-obsidian-border h-full">
            <NavContent />
          </div>
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  )
}
