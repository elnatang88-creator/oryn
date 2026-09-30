import { AppShell } from '@/components/AppShell'
import { requireUser } from '@/lib/server/request'

export const dynamic = 'force-dynamic'

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  return <AppShell user={user}>{children}</AppShell>
}
