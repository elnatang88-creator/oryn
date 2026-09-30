import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StatsGrid } from '@/components/analytics/StatsGrid'
import { ViewsChart } from '@/components/analytics/ViewsChart'
import { Badge } from '@/components/ui/Badge'
import { formatRelative } from '@/lib/utils'
import { subDays, format, eachDayOfInterval, startOfDay } from 'date-fns'
import { Globe, Monitor, Smartphone, Tablet } from 'lucide-react'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const now = new Date()
  const thirtyDaysAgo = subDays(now, 30)
  const sevenDaysAgo = subDays(now, 7)
  const today = startOfDay(now)

  const [
    { count: viewsToday },
    { count: viewsWeek },
    { data: allViews },
  ] = await Promise.all([
    supabase.from('card_views').select('*', { count: 'exact', head: true })
      .eq('profile_id', profile.id).gte('created_at', today.toISOString()),
    supabase.from('card_views').select('*', { count: 'exact', head: true })
      .eq('profile_id', profile.id).gte('created_at', sevenDaysAgo.toISOString()),
    supabase.from('card_views').select('*')
      .eq('profile_id', profile.id).gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false }),
  ])

  // Build views-by-day
  const days = eachDayOfInterval({ start: thirtyDaysAgo, end: now })
  const countMap: Record<string, number> = {}
  const deviceMap: Record<string, number> = {}
  const countryMap: Record<string, number> = {}

  for (const v of allViews ?? []) {
    const d = format(new Date(v.created_at), 'yyyy-MM-dd')
    countMap[d] = (countMap[d] ?? 0) + 1
    const dev = v.viewer_device ?? 'Unknown'
    deviceMap[dev] = (deviceMap[dev] ?? 0) + 1
    const country = v.viewer_country ?? 'Unknown'
    countryMap[country] = (countryMap[country] ?? 0) + 1
  }

  const viewsByDay = days.map((d) => ({
    date: format(d, 'yyyy-MM-dd'),
    count: countMap[format(d, 'yyyy-MM-dd')] ?? 0,
  }))

  const topCountries = Object.entries(countryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const topDevices = Object.entries(deviceMap).sort((a, b) => b[1] - a[1])

  const deviceIcon = (d: string) => {
    if (d === 'Mobile') return <Smartphone size={14} className="text-gold" />
    if (d === 'Tablet') return <Tablet size={14} className="text-gold" />
    return <Monitor size={14} className="text-gold" />
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-cream">Analytics</h1>
        <p className="text-sm text-cream/40 mt-1">Track every view and interaction on your card.</p>
      </div>

      <StatsGrid
        totalViews={profile.total_views}
        totalLeads={profile.total_leads}
        viewsThisWeek={viewsWeek ?? 0}
        viewsToday={viewsToday ?? 0}
      />

      <ViewsChart data={viewsByDay} />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Countries */}
        <div className="stat-card space-y-4">
          <p className="text-sm font-medium text-cream/70">Top Locations</p>
          {!topCountries.length ? (
            <p className="text-sm text-cream/30">No location data yet.</p>
          ) : (
            <div className="space-y-3">
              {topCountries.map(([country, count]) => {
                const pct = Math.round((count / (allViews?.length || 1)) * 100)
                return (
                  <div key={country} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-cream/70">
                        <Globe size={12} className="text-gold/60" />
                        {country}
                      </div>
                      <span className="text-cream/40 text-xs">{count} views</span>
                    </div>
                    <div className="h-1 rounded-full bg-obsidian-raised overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold/60 to-gold"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Devices */}
        <div className="stat-card space-y-4">
          <p className="text-sm font-medium text-cream/70">Devices</p>
          {!topDevices.length ? (
            <p className="text-sm text-cream/30">No device data yet.</p>
          ) : (
            <div className="space-y-3">
              {topDevices.map(([device, count]) => {
                const pct = Math.round((count / (allViews?.length || 1)) * 100)
                return (
                  <div key={device} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-cream/70">
                        {deviceIcon(device)}
                        {device}
                      </div>
                      <span className="text-cream/40 text-xs">{pct}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-obsidian-raised overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-olive/60 to-olive-muted"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent views */}
      <div className="stat-card space-y-4">
        <p className="text-sm font-medium text-cream/70">Recent Views</p>
        {!allViews?.length ? (
          <p className="text-sm text-cream/30 py-4 text-center">No views recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {allViews.slice(0, 10).map((view) => (
              <div key={view.id} className="flex items-center justify-between py-2.5 border-b border-obsidian-border/40 last:border-0">
                <div className="flex items-center gap-3">
                  {deviceIcon(view.viewer_device ?? 'Desktop')}
                  <div>
                    <p className="text-sm text-cream/70">
                      {view.viewer_city || view.viewer_country || 'Unknown location'}
                    </p>
                    <p className="text-xs text-cream/30">{view.viewer_browser ?? 'Unknown browser'}</p>
                  </div>
                </div>
                <span className="text-xs text-cream/30">{formatRelative(view.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
