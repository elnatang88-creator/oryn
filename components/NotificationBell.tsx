'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Bell } from 'lucide-react'
import { useLive } from '@/lib/live'

/** The bell: unread count from the server on load, kept current by the live stream (SSE) without polling. */
export function NotificationBell({ initial, compact = false }: { initial: number; compact?: boolean }) {
  const [unread, setUnread] = useState(initial)
  useLive(['notifications'], { onEvent: (name, data) => { if (name === 'notifications') setUnread(Number((data as { unread?: number })?.unread ?? 0)) } })
  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
  return (
    <Link href="/notifications" className={compact ? 'btn-quiet relative' : 'relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-ink-muted hover:bg-soft-100 hover:text-ink'} aria-label={label} data-testid="notification-bell" data-unread={unread}>
      <span className="relative"><Bell className="h-5 w-5" aria-hidden="true" />{unread > 0 && <span className="absolute -end-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-electric px-1 text-[10px] font-bold text-white" data-testid="notification-count">{unread > 99 ? '99+' : unread}</span>}</span>
      {!compact && 'Notifications'}
    </Link>
  )
}
