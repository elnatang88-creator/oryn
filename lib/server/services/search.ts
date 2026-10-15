import 'server-only'
import { getDb } from '../db'

export interface Hit { kind: 'person' | 'event' | 'station' | 'lead' | 'workspace' | 'card'; id: string; title: string; sub: string; href: string }

/** ⌘K search across what this user is allowed to see. Each branch is scoped by ownership or membership. */
export async function globalSearch(userId: string, q: string): Promise<Hit[]> {
  const term = q.trim().slice(0, 60)
  if (term.length < 2) return []
  const db = await getDb()
  const like = `%${term}%`
  const [people, cards, events, stations, leads, orgs] = await Promise.all([
    db.query<{ id: string; name: string; headline: string; met_where: string }>(`SELECT id, name, headline, met_where FROM connections WHERE owner_user_id = $1 AND status = 'active' AND (name ILIKE $2 OR headline ILIKE $2 OR met_where ILIKE $2 OR array_to_string(tags, ' ') ILIKE $2) ORDER BY met_at DESC LIMIT 6`, [userId, like]),
    db.query<{ id: string; name: string; display_name: string }>(`SELECT id, name, display_name FROM capsules WHERE owner_user_id = $1 AND status = 'active' AND (name ILIKE $2 OR display_name ILIKE $2) LIMIT 4`, [userId, like]),
    db.query<{ id: string; name: string; venue: string }>(`SELECT e.id, e.name, e.venue FROM events e WHERE e.name ILIKE $2 AND (EXISTS (SELECT 1 FROM memberships m WHERE m.org_id = e.org_id AND m.user_id = $1) OR EXISTS (SELECT 1 FROM event_participants p WHERE p.event_id = e.id AND p.user_id = $1 AND p.status <> 'removed')) LIMIT 5`, [userId, like]),
    db.query<{ id: string; name: string; org_id: string; mode: string }>(`SELECT st.id, st.name, st.org_id, st.mode FROM stations st WHERE st.name ILIKE $2 AND EXISTS (SELECT 1 FROM memberships m WHERE m.org_id = st.org_id AND m.user_id = $1) LIMIT 5`, [userId, like]),
    db.query<{ id: string; name: string; company: string; stage: string }>(`SELECT l.id, l.name, l.company, l.stage FROM leads l WHERE (l.name ILIKE $2 OR l.company ILIKE $2 OR l.email ILIKE $2) AND EXISTS (SELECT 1 FROM memberships m WHERE m.org_id = l.org_id AND m.user_id = $1) ORDER BY l.updated_at DESC LIMIT 6`, [userId, like]),
    db.query<{ id: string; name: string }>(`SELECT o.id, o.name FROM organizations o JOIN memberships m ON m.org_id = o.id AND m.user_id = $1 WHERE o.name ILIKE $2 LIMIT 3`, [userId, like]),
  ])
  return [
    ...people.map((p): Hit => ({ kind: 'person', id: p.id, title: p.name, sub: [p.headline, p.met_where].filter(Boolean).join(' · '), href: `/connections/${p.id}` })),
    ...leads.map((l): Hit => ({ kind: 'lead', id: l.id, title: l.name, sub: [l.company, l.stage].filter(Boolean).join(' · '), href: `/business/leads/${l.id}` })),
    ...events.map((e): Hit => ({ kind: 'event', id: e.id, title: e.name, sub: e.venue, href: `/events/${e.id}` })),
    ...cards.map((c): Hit => ({ kind: 'card', id: c.id, title: c.name, sub: c.display_name, href: `/capsules/${c.id}` })),
    ...stations.map((s): Hit => ({ kind: 'station', id: s.id, title: s.name, sub: `Station · ${s.mode}`, href: `/stations?org=${s.org_id}` })),
    ...orgs.map((o): Hit => ({ kind: 'workspace', id: o.id, title: o.name, sub: 'Workspace', href: `/business?org=${o.id}` })),
  ]
}
