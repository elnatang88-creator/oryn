import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardNav } from '@/components/layout/DashboardNav'
import { Profile } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen bg-obsidian">
      <DashboardNav profile={profile as Profile} isAdmin={profile?.is_admin} />
      <main className="flex-1 min-w-0 lg:ml-0">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  )
}
