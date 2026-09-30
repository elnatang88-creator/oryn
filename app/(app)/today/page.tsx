import Link from 'next/link'
import { ArrowRight, Bell, CheckCircle2, Circle, QrCode, UserPlus } from 'lucide-react'
import { requireUser } from '@/lib/server/request'
import { relationshipSummary, todaySummary } from '@/lib/server/services/today'
import { listCapsules } from '@/lib/server/services/capsules'
import { RespondButtons } from '@/components/RespondButtons'
import { toggleFollowUpAction, markReadAction } from '@/app/actions/connections'
import { revokeShareAction } from '@/app/actions/sharing'
import { Empty, PageHeader, Section, fmtDate, relTime } from '@/components/ui'
import { listViewers, viewerSummary } from '@/lib/server/services/viewers'
import { ViewersPanel } from '@/components/ViewersPanel'
import { LiveRefresh } from '@/components/LiveRefresh'

export const metadata = { title: 'Today' }

const ACTIVITY: Record<string, string> = {
  opened: 'Your card was opened',
  expanded: 'Someone chose “Learn more”',
  saved_vcard: 'Your details were saved to a phone',
  kept: 'Your card was kept in ORYN',
  connect_requested: 'New request to connect',
  blocked_revoked: 'A stopped link was tried — it stayed closed',
}

// Plain anchor: this starts a share, so it must never be prefetched.
// eslint-disable-next-line @next/next/no-html-link-for-pages
const shareNow = <a href="/share/quick" className="text-sm font-semibold text-electric-600">Share now</a>

export default async function TodayPage() {
  const user = await requireUser()
  const [t, capsules, vs, rs] = await Promise.all([todaySummary(user.id), listCapsules(user.id), viewerSummary(user.id), relationshipSummary(user.id)])
  const viewers = vs.canSeeWho ? await listViewers(user.id, 8) : null
  const first = user.display_name.split(' ')[0]

  if (capsules.length === 0) {
    return (
      <>
        <PageHeader title={`Hi ${first}`} sub="Start with your card. It takes about a minute." />
        <Empty title="No card yet" body="Your card is what people see when you share. You choose every detail on it." action={<Link href="/capsules/new" className="btn-share">Create my card</Link>} />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Today" sub="Who you met, what’s next, and what’s working." />

      <LiveRefresh />
      <section className="mb-8" aria-labelledby="week" data-testid="this-week">
        <h2 id="week" className="h2 mb-3">This week</h2>
        <dl className="grid grid-cols-4 gap-2">
          {([['Card opens', rs.week.opens], ['Connections', rs.week.connections], ['Saves', rs.week.saves], ['Follow-ups', rs.week.followups]] as const).map(([k, v]) => (
            <div key={k} className="card px-2 py-3 text-center" data-testid={`week-${k.toLowerCase().replace(/\W+/g, '-')}`}><dd className="text-2xl font-bold tabular-nums text-navy-900">{v}</dd><dt className="text-[11px] font-semibold leading-tight text-ink-muted">{k}</dt></div>
          ))}
        </dl>
        {(rs.topCards.length > 0 || rs.topChannel) && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {rs.topCards[0] && <div className="card px-4 py-3" data-testid="top-card"><p className="text-xs font-semibold text-ink-muted">Top card · 30 days</p><p dir="auto" className="truncate font-semibold">{rs.topCards[0].name}</p><p className="text-xs text-ink-muted">{rs.topCards[0].n} connections</p></div>}
            {rs.topChannel && <div className="card px-4 py-3" data-testid="top-channel"><p className="text-xs font-semibold text-ink-muted">Top source · 30 days</p><p className="truncate font-semibold">{rs.topChannel.label}</p><p className="text-xs text-ink-muted">{rs.topChannel.n} connections</p></div>}
          </div>
        )}
        {rs.quiet.length > 0 && (
          <div className="card mt-2 px-4 py-3" data-testid="worth-follow-up">
            <p className="text-sm font-semibold">Worth a follow-up</p>
            <ul className="mt-1 divide-y divide-soft-100">
              {rs.quiet.map((q) => (
                <li key={q.id}><Link href={`/connections/${q.id}`} className="flex min-h-[48px] items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0"><span dir="auto" className="block truncate font-medium">{q.name}</span><span className="block truncate text-xs text-ink-muted">{q.place ? `${q.place} · ` : ''}{relTime(q.met_at)} · no note yet</span></span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
                </Link></li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <ViewersPanel summary={vs} viewers={viewers} />

      {t.notifications.length > 0 && (
        <div className="card mb-6 flex items-start gap-3 px-4 py-3">
          <Bell className="mt-0.5 h-5 w-5 text-electric" aria-hidden="true" />
          <ul className="flex-1 space-y-1 text-[15px]">
            {t.notifications.map((n) => <li key={n.id}>{n.link ? <Link className="font-medium hover:underline" href={n.link}>{n.body}</Link> : n.body}</li>)}
          </ul>
          <form action={markReadAction}><button className="btn-quiet text-sm">Clear</button></form>
        </div>
      )}

      {t.pending.length > 0 && (
        <Section title="Waiting for you" aside={<Link href="/connections/requests" className="text-sm font-semibold text-electric-600">All requests</Link>}>
          <ul className="space-y-3">
            {t.pending.map((r) => (
              <li key={r.id} className="card p-4" data-testid="pending-request">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-soft-100 text-electric-600"><UserPlus className="h-5 w-5" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold"><bdi>{r.from_name}</bdi> would like to connect</p>
                    <p className="text-sm text-ink-muted">{r.context_label || 'From a share'} · {relTime(r.created_at)}</p>
                    {r.message && <p dir="auto" className="mt-2 rounded-xl bg-soft-50 px-3 py-2 text-[15px]">“{r.message}”</p>}
                  </div>
                </div>
<RespondButtons id={r.id} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-muted">“Not now” is private. They are never told.</p>
        </Section>
      )}

      <Section title="What’s next" aside={<Link href="/follow-ups" className="text-sm font-semibold text-electric-600">All follow-ups</Link>}>
        {t.due.length === 0 ? (
          <p className="card px-4 py-4 text-[15px] text-ink-muted">Nothing due. Enjoy the quiet.</p>
        ) : (
          <ul className="card divide-y divide-soft-100">
            {t.due.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                <form action={toggleFollowUpAction}>
                  <input type="hidden" name="id" value={f.id} /><input type="hidden" name="done" value="true" />
                  <button className="grid h-11 w-11 place-items-center rounded-xl text-ink-faint hover:text-signal-ok" aria-label={`Mark “${f.title}” done`}><Circle className="h-6 w-6" /></button>
                </form>
                <Link href={`/connections/${f.connection_id}`} className="min-w-0 flex-1">
                  <p dir="auto" className="truncate font-medium">{f.title}</p>
                  <p className={`text-sm ${f.overdue ? 'text-signal-warn' : 'text-ink-muted'}`}>{f.name} · {f.overdue ? 'was due ' : ''}{fmtDate(f.due_on)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Who you met" aside={<Link href="/connections" className="text-sm font-semibold text-electric-600">Everyone</Link>}>
        {t.newConnections.length === 0 ? (
          <p className="card px-4 py-4 text-[15px] text-ink-muted">When someone connects with you, they appear here with where you met.</p>
        ) : (
          <ul className="card divide-y divide-soft-100">
            {t.newConnections.map((c) => (
              <li key={c.id}>
                <Link href={`/connections/${c.id}`} className="flex min-h-[60px] items-center justify-between gap-3 px-4 py-3 hover:bg-soft-50">
                  <span className="min-w-0"><span dir="auto" className="block truncate font-semibold">{c.name}</span><span className="block truncate text-sm text-ink-muted">{c.met_where || 'Met recently'} · {relTime(c.met_at)}</span></span>
                  <ArrowRight className="h-5 w-5 text-ink-faint" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="What you’re sharing" aside={shareNow}>
        {t.shares.length === 0 ? (
          <p className="card px-4 py-4 text-[15px] text-ink-muted">Nothing is being shared right now.</p>
        ) : (
          <ul className="space-y-2">
            {t.shares.map((s) => (
              <li key={s.id} className="card flex items-center gap-3 px-4 py-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-soft-100 text-electric-600"><QrCode className="h-5 w-5" aria-hidden="true" /></span>
                <Link href={`/share/${s.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.capsule_name}{s.context_label ? ` · ${s.context_label}` : ''}</p>
                  <p className="text-sm text-ink-muted">Opened {s.view_count} {s.view_count === 1 ? 'time' : 'times'} · started {relTime(s.created_at)}</p>
                </Link>
                <form action={revokeShareAction}>
                  <input type="hidden" name="id" value={s.id} /><input type="hidden" name="back" value="/today" />
                  <button className="btn-quiet text-sm text-signal-stop">Stop</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recently">
        {t.activity.length === 0 ? (
          <p className="card px-4 py-4 text-[15px] text-ink-muted">Quiet so far.</p>
        ) : (
          <ul className="card divide-y divide-soft-100">
            {t.activity.map((a, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3 text-[15px]">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-electric-400" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{ACTIVITY[a.kind] ?? a.kind} <span className="text-ink-muted">· {a.capsule_name}{a.context_label ? `, ${a.context_label}` : ''}</span></span>
                <span className="shrink-0 text-sm text-ink-muted">{relTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}
