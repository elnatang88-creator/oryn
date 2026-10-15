import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/Badge'
import { formatRelative, formatNumber } from '@/lib/utils'
import { Users, Eye, TrendingUp, Shield } from 'lucide-react'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminProfile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!adminProfile?.is_admin) redirect('/dashboard')

  const [
    { count: totalUsers },
    { count: activeUsers },
    { count: proUsers },
    { data: recentUsers },
    { count: totalViewsCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).neq('plan', 'free'),
    supabase.from('profiles').select('id,username,full_name,plan,total_views,total_leads,created_at,is_active')
      .order('created_at', { ascending: false }).limit(20),
    supabase.from('card_views').select('*', { count: 'exact', head: true }),
  ])

  const stats = [
    { label: 'Total Users', value: formatNumber(totalUsers ?? 0), icon: Users, color: 'text-cream' },
    { label: 'Active Cards', value: formatNumber(activeUsers ?? 0), icon: Shield, color: 'text-olive-subtle' },
    { label: 'Paid Users', value: formatNumber(proUsers ?? 0), icon: TrendingUp, color: 'text-gold' },
    { label: 'Total Views', value: formatNumber(totalViewsCount ?? 0), icon: Eye, color: 'text-gold' },
  ]

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-chip bg-gold/10 border border-gold/20 flex items-center justify-center">
            <Shield size={16} className="text-gold" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-cream">Admin Dashboard</h1>
            <p className="text-xs text-cream/40">Platform overview · ORYN</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-cream/40 uppercase tracking-wider">{label}</p>
                <Icon size={14} className={color} />
              </div>
              <p className="text-2xl font-display font-semibold text-cream">{value}</p>
            </div>
          ))}
        </div>

        {/* Users table */}
        <div className="stat-card space-y-4">
          <p className="text-sm font-medium text-cream/70">Recent Users</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-obsidian-border">
                  {['User', 'Plan', 'Views', 'Leads', 'Status', 'Joined'].map((h) => (
                    <th key={h} className="text-left py-3 px-2 text-xs text-cream/30 uppercase tracking-wider font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-obsidian-border/40">
                {recentUsers?.map((u) => (
                  <tr key={u.id} className="hover:bg-obsidian-raised/50 transition-colors">
                    <td className="py-3 px-2">
                      <div>
                        <p className="text-cream/80">{u.full_name || '—'}</p>
                        <p className="text-xs text-cream/30">@{u.username}</p>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <Badge variant={u.plan === 'free' ? 'muted' : 'gold'} className="capitalize text-xs">
                        {u.plan}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-cream/60">{formatNumber(u.total_views)}</td>
                    <td className="py-3 px-2 text-cream/60">{formatNumber(u.total_leads)}</td>
                    <td className="py-3 px-2">
                      <Badge variant={u.is_active ? 'green' : 'red'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-cream/40 text-xs">{formatRelative(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
