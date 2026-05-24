'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { format, parseISO } from 'date-fns'

interface ViewsChartProps {
  data: { date: string; count: number }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-panel px-3 py-2 rounded-chip text-sm">
      <p className="text-cream/50 text-xs mb-1">{label}</p>
      <p className="text-gold font-medium">{payload[0].value} views</p>
    </div>
  )
}

export function ViewsChart({ data }: ViewsChartProps) {
  const formatted = data.map((d) => ({
    date: format(parseISO(d.date), 'MMM d'),
    count: d.count,
  }))

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-medium text-cream/80">Views Over Time</h3>
          <p className="text-xs text-cream/40 mt-0.5">Last 30 days</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={formatted} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(44,44,46,0.6)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'rgba(245,240,232,0.3)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(245,240,232,0.3)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#C9A84C"
            strokeWidth={2}
            fill="url(#goldGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#C9A84C', stroke: '#0A0A0A', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
