import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatsGrid } from '@/components/analytics/StatsGrid'
import { ViewsChart } from '@/components/analytics/ViewsChart'
import { BusinessCard } from '@/components/card/BusinessCard'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'
import { subDays, format, eachDayOfInterval } from 'date-fns'
import { ArrowRight, Share2, QrCode, Wallet } from 'lucide-react'
import { Profile } from '@/types'

async function getAnalytics(profileId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const now = new Date()
  const thirtyDaysAgo = subDays(now, 30)
  const sevenDaysAgo = subDays(now, 7)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [{ count: viewsToday }, { count: viewsWeek }, { data: viewsRaw }] = await Promise.all([
    supabase
      .from('card_views')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .gte('created_at', today.toISOString()),
    supabase
      .from('card_views')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .gte('created_at', sevenDaysAgo.toISOString()),
    supabase
      .from('card_views')
      .select('created_at')
      .eq('profile_id', profileId)
      .gte('created_at', thirtyDaysAgo.toISOString()),
  ])

  // Build views-by-day array
  const days = eachDayOfInterval({ start: thirtyDaysAgo, end: now })
  const countMap: Record<string, number> = {}
  for (const v of viewsRaw ?? []) {
    const d = format(new Date(v.created_at), 'yyyy-MM-dd')
    countMap[d] = (countMap[d] ?? 0) + 1
  }
  const viewsByDay = days.map((d) => ({
    date: format(d, 'yyyy-MM-dd'),
    count: countMap[format(d, 'yyyy-MM-dd')] ?? 0,
  }))

  return { viewsToday: viewsToday ?? 0, viewsWeek: viewsWeek ?? 0, viewsByDay }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { viewsToday, viewsWeek, viewsByDay } = await getAnalytics(profile.id, supabase)

  const { data: recentLeads } = await supabase
    .from('leads')
    .select('*')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(3)

  const cardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/${profile.username}`

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl text-cream">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},
            {' '}{profile.full_name?.split(' ')[0] ?? 'there'}.
          </h1>
          <p className="text-sm text-cream/40 mt-1">Here's what's happening with your card.</p>
        </div>
        <Badge variant="gold" className="capitalize">{profile.plan}</Badge>
      </div>

      {/* Stats */}
      <StatsGrid
        totalViews={profile.total_views}
        totalLeads={profile.total_leads}
        viewsThisWeek={viewsWeek}
        viewsToday={viewsToday}
      />

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart — spans 2 cols */}
        <div className="lg:col-span-2">
          <ViewsChart data={viewsByDay} />
        </div>

        {/* Card preview */}
        <div className="stat-card flex flex-col items-center gap-5 justify-between">
          <div className="w-full">
            <p className="text-xs text-cream/40 uppercase tracking-wider mb-4">Your Card</p>
            <BusinessCard profile={profile as Profile} size="full" />
          </div>

          <div className="w-full space-y-2">
            <Link href="/dashboard/card" className="btn-secondary w-full text-sm justify-center">
              Edit Card <ArrowRight size={14} />
            </Link>
            <a href={cardUrl} target="_blank" rel="noopener noreferrer"
              className="btn-ghost w-full text-sm justify-center text-cream/50"
            >
              <Share2 size={14} /> View Public Card
            </a>
          </div>
        </div>
      </div>

      {/* Quick actions + recent leads */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Quick actions */}
        <div className="stat-card space-y-4">
          <p className="text-sm font-medium text-cream/70">Quick Actions</p>
          <div className="space-y-2">
            <Link href="/dashboard/card"
              className="flex items-center gap-3 px-4 py-3 rounded-chip bg-obsidian-raised hover:bg-obsidian-muted/30 transition-colors group"
            >
              <div className="w-8 h-8 rounded-md bg-gold/8 border border-gold/15 flex items-center justify-center">
                <QrCode size={14} className="text-gold" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-cream/80">Share QR Code</p>
                <p className="text-xs text-cream/40">Instant contact exchange</p>
              </div>
              <ArrowRight size={14} className="text-cream/30 group-hover:text-cream/60 transition-colors" />
            </Link>

            <Link href="/dashboard/card"
              className="flex items-center gap-3 px-4 py-3 rounded-chip bg-obsidian-raised hover:bg-obsidian-muted/30 transition-colors group"
            >
              <div className="w-8 h-8 rounded-md bg-gold/8 border border-gold/15 flex items-center justify-center">
                <Wallet size={14} className="text-gold" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-cream/80">Add to Wallet</p>
                <p className="text-xs text-cream/40">Apple & Google Wallet</p>
              </div>
              <ArrowRight size={14} className="text-cream/30 group-hover:text-cream/60 transition-colors" />
            </Link>
          </div>
        </div>

        {/* Recent leads */}
        <div className="stat-card space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-cream/70">Recent Leads</p>
            <Link href="/dashboard/leads" className="text-xs text-gold hover:text-gold-light transition-colors">
              View all
            </Link>
          </div>

          {!recentLeads?.length ? (
            <p className="text-sm text-cream/30 py-4 text-center">No leads yet. Share your card to start!</p>
          ) : (
            <div className="space-y-2">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center gap-3 px-3 py-2.5 rounded-chip bg-obsidian-raised">
                  <div className="w-7 h-7 rounded-full bg-olive/20 border border-olive/30 flex items-center justify-center text-xs text-olive-subtle font-display font-semibold shrink-0">
                    {lead.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-cream/80 truncate">{lead.name}</p>
                    <p className="text-xs text-cream/40 truncate">{lead.email || lead.company || 'No details'}</p>
                  </div>
                  {!lead.is_read && (
                    <span className="w-2 h-2 rounded-full bg-gold shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
