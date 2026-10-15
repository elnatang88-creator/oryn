import { AppShell } from '@/components/AppShell'
import { requireUser } from '@/lib/server/request'
import { unreadCount } from '@/lib/server/services/today'

export const dynamic = 'force-dynamic'

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const unread = await unreadCount(user.id).catch(() => 0)
  return <AppShell user={user} unread={unread}>{children}</AppShell>
}
