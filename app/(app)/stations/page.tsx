import Link from 'next/link'
import QRCode from 'qrcode'
import { appOrigin, requireUser } from '@/lib/server/request'
import { listMyOrgs } from '@/lib/server/services/orgs'
import { listStations } from '@/lib/server/services/stations'
import { listCapsules } from '@/lib/server/services/capsules'
import { listEvents } from '@/lib/server/services/events'
import { acceptTransferAction, configureStationAction, createStationAction, startTransferAction, stationActiveAction } from '@/app/actions/workspace'
import { MODE_LABEL, STATION_MODES, stationAnalytics } from '@/lib/server/services/stations'
import { ActionForm, Submit } from '@/components/Forms'
import { Empty, PageHeader } from '@/components/ui'

export const metadata = { title: 'Stations' }

export default async function StationsPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const sp = await searchParams
  const user = await requireUser()
  const orgs = await listMyOrgs(user.id)
  if (!orgs.length) return (<><PageHeader title="Stations" /><Empty title="Stations belong to a team workspace" body="A station is a fixed QR code for a booth, desk, table or counter." action={<Link href="/teams" className="btn-share">Create a workspace</Link>} /></>)
  const org = orgs.find((o) => o.id === sp.org) ?? orgs[0]
  const canManage = ['owner', 'admin', 'manager'].includes(org.role)
  const [stations, capsules, events, origin, analytics] = await Promise.all([listStations(user.id, org.id), listCapsules(user.id), listEvents(user.id), appOrigin(), stationAnalytics(user.id, org.id)])
  const qrs = await Promise.all(stations.map((s) => QRCode.toString(`${origin}/q/${s.code}`, { type: 'svg', margin: 1, color: { dark: '#011441', light: '#FFFFFF' } })))

  return (
    <>
      <PageHeader title="Stations & QR codes" sub={`${org.name}. Print a code once — change what it shows any time.`} />
      {stations.length === 0 && <p className="card mb-6 px-4 py-4 text-ink-muted">No stations yet.</p>}
      <ul className="mb-8 grid gap-4 sm:grid-cols-2">
        {stations.map((s, i) => (
          <li key={s.id} className="card p-4" data-testid="station">
            <div className="flex gap-4">
              <div className="w-28 shrink-0 rounded-xl border border-soft-200 p-1.5" role="img" aria-label={`QR code for ${s.name}`} dangerouslySetInnerHTML={{ __html: qrs[i] }} />
              <div className="min-w-0">
                <p className="font-bold text-navy-900">{s.name}</p>
                <p className="text-sm capitalize text-ink-muted">{s.kind}{s.event_name ? ` · ${s.event_name}` : ''}</p>
                <p className="mt-1 text-sm">Shows: <span className="font-semibold">{s.capsule_name ?? '—'}</span></p>
                <p className="text-sm text-ink-muted">Opened {s.opened} · {s.requests} requests</p>
                <a href={`/s/${s.code}`} className="mt-1 block truncate text-xs text-electric-600 underline" target="_blank" rel="noopener" data-testid="station-url">{origin}/s/{s.code}</a>
                {(() => { const a = analytics.find((x) => x.station_id === s.id); return a ? <p className="mt-1 text-xs text-ink-muted" data-testid="station-stats">30 days: {a.scans} taps · {a.leads} leads · {a.registrations} registrations</p> : null })()}
              </div>
            </div>
            {canManage && (
              <div className="mt-3 space-y-2 border-t border-soft-100 pt-3">
                <ActionForm action={configureStationAction} className="space-y-2" id={`cfg-${s.id}`}>
                  <input type="hidden" name="id" value={s.id} />
                  <div className="grid grid-cols-2 gap-2">
                    <div><label htmlFor={`mode-${s.id}`} className="text-xs font-semibold text-ink-muted">What it does</label>
                      <select id={`mode-${s.id}`} name="mode" defaultValue={(s as { mode?: string }).mode ?? 'card'} className="input mt-0 min-h-[44px] text-sm" data-testid="station-mode">{STATION_MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}</select></div>
                    <div><label htmlFor={`cap-${s.id}`} className="text-xs font-semibold text-ink-muted">Card shown</label>
                      <select id={`cap-${s.id}`} name="capsuleId" className="input mt-0 min-h-[44px] text-sm"><option value="">Keep current</option>{capsules.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    <div><label htmlFor={`ev-${s.id}`} className="text-xs font-semibold text-ink-muted">Event</label>
                      <select id={`ev-${s.id}`} name="eventId" className="input mt-0 min-h-[44px] text-sm"><option value="">None</option>{events.filter((e) => e.org_id === org.id).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
                    <div><label htmlFor={`url-${s.id}`} className="text-xs font-semibold text-ink-muted">https:// link (booking / custom)</label>
                      <input dir="ltr" id={`url-${s.id}`} name="destinationUrl" defaultValue={(s as { destination_url?: string | null }).destination_url ?? ''} className="input mt-0 min-h-[44px] text-sm" placeholder="https://cal.example/team" /></div>
                  </div>
                  <input dir="auto" name="headline" placeholder="Headline for visitors (optional)" className="input mt-0 min-h-[44px] text-sm" maxLength={80} />
                  <Submit className="btn-more min-h-[44px] w-full text-sm">Update station</Submit>
                </ActionForm>
                {org.role === 'owner' || org.role === 'admin' ? <ActionForm action={startTransferAction}><input type="hidden" name="id" value={s.id} /><Submit className="btn-quiet w-full text-sm">Transfer to another workspace…</Submit></ActionForm> : null}
                <form action={stationActiveAction}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="active" value={s.status === 'active' ? 'false' : 'true'} />
                  <button className="btn-quiet w-full text-sm">{s.status === 'active' ? 'Pause this station' : 'Resume this station'}</button></form>
              </div>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <>
          <ActionForm action={acceptTransferAction} className="card mb-8 flex flex-wrap items-end gap-2 p-4">
            <input type="hidden" name="orgId" value={org.id} />
            <div className="flex-1"><label className="label" htmlFor="tcode">Receive a station</label><input dir="ltr" id="tcode" name="code" className="input" placeholder="Transfer code from the other workspace" /></div>
            <Submit className="btn-more">Accept transfer</Submit>
          </ActionForm>
          <h2 className="h2 mb-3">New station</h2>
          {capsules.length === 0 ? <p className="text-ink-muted">Create a capsule first — it’s what the station shows.</p> : (
            <ActionForm action={createStationAction} className="card grid gap-3 p-4 sm:grid-cols-2">
              <input type="hidden" name="orgId" value={org.id} />
              <div><label className="label" htmlFor="sname">Name</label><input dir="auto" id="sname" name="name" className="input" placeholder="Booth 14" maxLength={60} /></div>
              <div><label className="label" htmlFor="kind">Kind</label><select id="kind" name="kind" className="input">{['booth', 'table', 'desk', 'room', 'counter', 'person'].map((k) => <option key={k} value={k} className="capitalize">{k}</option>)}</select></div>
              <div><label className="label" htmlFor="capsuleId">Shows</label><select id="capsuleId" name="capsuleId" className="input">{capsules.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label className="label" htmlFor="eventId">Event</label><select id="eventId" name="eventId" className="input"><option value="">None</option>{events.filter((e) => e.org_id === org.id).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
              <div className="sm:col-span-2"><Submit>Create station</Submit></div>
            </ActionForm>
          )}
        </>
      )}
    </>
  )
}
