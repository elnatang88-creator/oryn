'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Lead } from '@/types'
import { formatRelative, formatDate } from '@/lib/utils'
import { Mail, Phone, Building2, MessageSquare, Download, Filter } from 'lucide-react'

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [selected, setSelected] = useState<Lead | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
      setLeads(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const markRead = async (leadId: string) => {
    await supabase.from('leads').update({ is_read: true }).eq('id', leadId)
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, is_read: true } : l))
    if (selected?.id === leadId) setSelected((s) => s ? { ...s, is_read: true } : s)
  }

  const exportCsv = () => {
    const rows = [
      ['Name', 'Email', 'Phone', 'Company', 'Message', 'Date'],
      ...leads.map((l) => [l.name, l.email ?? '', l.phone ?? '', l.company ?? '', l.message ?? '', formatDate(l.created_at)]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'oryn-leads.csv'
    a.click()
  }

  const filtered = leads.filter((l) =>
    filter === 'all' ? true : filter === 'unread' ? !l.is_read : l.is_read
  )
  const unreadCount = leads.filter((l) => !l.is_read).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl text-cream">Leads</h1>
          <p className="text-sm text-cream/40 mt-1">
            {leads.length} total · <span className="text-gold">{unreadCount} unread</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <Download size={14} /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {(['all', 'unread', 'read'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-chip text-sm capitalize transition-all ${
              filter === f
                ? 'bg-gold/10 border border-gold/20 text-gold'
                : 'text-cream/40 hover:text-cream/60 hover:bg-obsidian-raised'
            }`}
          >
            {f} {f === 'unread' && unreadCount > 0 && `(${unreadCount})`}
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <div className="stat-card text-center py-16 space-y-3">
          <p className="text-cream/30">No leads yet.</p>
          <p className="text-xs text-cream/20">Share your card to start capturing contacts.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Lead list */}
          <div className="space-y-2">
            {filtered.map((lead) => (
              <button key={lead.id}
                onClick={() => { setSelected(lead); if (!lead.is_read) markRead(lead.id) }}
                className={`w-full text-left p-4 rounded-panel transition-all duration-200 ${
                  selected?.id === lead.id
                    ? 'bg-gold/8 border border-gold/20'
                    : 'bg-obsidian-card border border-obsidian-border hover:border-gold/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-olive/15 border border-olive/25 flex items-center justify-center text-sm text-olive-subtle font-display font-semibold shrink-0">
                    {lead.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-cream/90 truncate">{lead.name}</p>
                      {!lead.is_read && <span className="w-2 h-2 rounded-full bg-gold shrink-0" />}
                    </div>
                    <p className="text-xs text-cream/40 truncate">{lead.email || lead.company || 'No details'}</p>
                    <p className="text-xs text-cream/25 mt-1">{formatRelative(lead.created_at)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Lead detail */}
          {selected ? (
            <div className="stat-card space-y-5 lg:sticky lg:top-8 lg:self-start">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-olive/15 border border-olive/25 flex items-center justify-center text-lg text-olive-subtle font-display font-semibold">
                  {selected.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-cream">{selected.name}</p>
                  <p className="text-xs text-cream/40">{formatDate(selected.created_at)}</p>
                </div>
              </div>

              <div className="section-divider" />

              <div className="space-y-3 text-sm">
                {selected.email && (
                  <div className="flex items-center gap-3 text-cream/60">
                    <Mail size={14} className="text-gold/60 shrink-0" />
                    <a href={`mailto:${selected.email}`} className="hover:text-gold transition-colors">{selected.email}</a>
                  </div>
                )}
                {selected.phone && (
                  <div className="flex items-center gap-3 text-cream/60">
                    <Phone size={14} className="text-gold/60 shrink-0" />
                    <a href={`tel:${selected.phone}`} className="hover:text-gold transition-colors">{selected.phone}</a>
                  </div>
                )}
                {selected.company && (
                  <div className="flex items-center gap-3 text-cream/60">
                    <Building2 size={14} className="text-gold/60 shrink-0" />
                    <span>{selected.company}</span>
                  </div>
                )}
              </div>

              {selected.message && (
                <>
                  <div className="section-divider" />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-cream/40">
                      <MessageSquare size={12} /> Message
                    </div>
                    <p className="text-sm text-cream/70 leading-relaxed bg-obsidian-raised p-3 rounded-chip">
                      {selected.message}
                    </p>
                  </div>
                </>
              )}

              <div className="section-divider" />
              <Badge variant={selected.is_read ? 'muted' : 'gold'}>
                {selected.is_read ? 'Read' : 'New Lead'}
              </Badge>
            </div>
          ) : (
            <div className="stat-card flex items-center justify-center text-cream/20 text-sm py-16 lg:sticky lg:top-8 lg:self-start">
              Select a lead to view details
            </div>
          )}
        </div>
      )}
    </div>
  )
}
