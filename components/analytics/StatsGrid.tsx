import { formatNumber } from '@/lib/utils'
import { Eye, Users, TrendingUp, Star } from 'lucide-react'

interface StatsGridProps {
  totalViews: number
  totalLeads: number
  viewsThisWeek: number
  viewsToday: number
}

export function StatsGrid({ totalViews, totalLeads, viewsThisWeek, viewsToday }: StatsGridProps) {
  const stats = [
    {
      label: 'Total Views',
      value: formatNumber(totalViews),
      icon: Eye,
      sub: `${viewsToday} today`,
      color: 'text-gold',
    },
    {
      label: 'Total Leads',
      value: formatNumber(totalLeads),
      icon: Users,
      sub: 'Captured contacts',
      color: 'text-olive-subtle',
    },
    {
      label: 'This Week',
      value: formatNumber(viewsThisWeek),
      icon: TrendingUp,
      sub: 'Views in 7 days',
      color: 'text-cream/60',
    },
    {
      label: 'Card Score',
      value: totalViews > 100 ? 'Elite' : totalViews > 20 ? 'Active' : 'Rising',
      icon: Star,
      sub: 'Profile rating',
      color: 'text-gold',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(({ label, value, icon: Icon, sub, color }) => (
        <div key={label} className="stat-card group hover:border-gold/10 transition-all duration-300">
          <div className="flex items-start justify-between mb-4">
            <p className="text-xs text-cream/40 uppercase tracking-wider">{label}</p>
            <div className="p-1.5 rounded-md bg-obsidian-raised">
              <Icon size={14} className={color} />
            </div>
          </div>
          <p className="text-2xl font-display font-semibold text-cream">{value}</p>
          <p className="text-xs text-cream/40 mt-1">{sub}</p>
        </div>
      ))}
    </div>
  )
}
