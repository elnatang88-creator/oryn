import Link from 'next/link'
import { Bell, BellRing, CalendarDays, Lock, ShieldAlert, UserPlus, Workflow, Briefcase, CheckSquare } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { listNotifications } from '@/lib/server/services/today'
import { markReadAction, readNotificationAction } from '@/app/actions/connections'
import { Empty, PageHeader, relTime } from '@/components/ui'

export const metadata = { title: 'Notifications' }

const ICON: Record<string, typeof Bell> = { connect_request: UserPlus, connect_accepted: UserPlus, followup: BellRing, task: CheckSquare, lead_assigned: Briefcase, automation: Workflow, event: CalendarDays, security: ShieldAlert }

/** Everything that happened for you, newest first. Opening one marks it read and takes you there. */
export default async function NotificationsPage() {
  const user = await requireUser()
  const items = await listNotifications(user.id)
  const unread = items.filter((n) => !n.read_at).length
  return (
    <>
      <PageHeader title="Notifications" sub={unread ? `${unread} unread` : 'All caught up'} action={unread ? <form action={markReadAction}><button className="btn-quiet text-sm">Mark all read</button></form> : <Link href="/settings/notifications" className="btn-quiet text-sm"><Lock className="h-4 w-4" aria-hidden="true" /> Preferences</Link>} />
      {items.length === 0 ? <Empty title="Nothing yet" body="Requests, acceptances, reminders, lead assignments and security alerts land here." /> : (
        <ul className="card divide-y divide-soft-100" data-testid="notifications">
          {items.map((n) => { const I = ICON[n.kind] ?? Bell; return (
            <li key={n.id} className={n.read_at ? '' : 'bg-soft-50'}>
              <form action={readNotificationAction}>
                <input type="hidden" name="id" value={n.id} /><input type="hidden" name="link" value={n.link ?? ''} />
                <button className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-start hover:bg-soft-100" data-testid="notification" data-read={!!n.read_at}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${n.read_at ? 'bg-soft-100 text-ink-muted' : 'bg-electric/10 text-electric'}`}><I className="h-5 w-5" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1"><span dir="auto" className={`block ${n.read_at ? '' : 'font-semibold'}`}>{n.body}</span><span className="block text-xs text-ink-muted">{relTime(n.created_at)}</span></span>
                  {!n.read_at && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-electric" aria-label="Unread" />}
                </button>
              </form>
            </li>) })}
        </ul>
      )}
    </>
  )
}
