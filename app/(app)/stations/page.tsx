import Link from 'next/link'
import QRCode from 'qrcode'
import { appOrigin, requireUser } from '@/lib/server/request'
import { listMyOrgs } from '@/lib/server/services/orgs'
import { listStations } from '@/lib/server/services/stations'
import { listCapsules } from '@/lib/server/services/capsules'
import { listEvents } from '@/lib/server/services/events'
import { createStationAction, reassignStationAction, stationActiveAction } from '@/app/actions/workspace'
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
  const [stations, capsules, events, origin] = await Promise.all([listStations(user.id, org.id), listCapsules(user.id), listEvents(user.id), appOrigin()])
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
                <a href={`/q/${s.code}`} className="mt-1 block truncate text-xs text-electric-600 underline" target="_blank" rel="noopener">{origin}/q/{s.code}</a>
              </div>
            </div>
            {canManage && (
              <div className="mt-3 space-y-2 border-t border-soft-100 pt-3">
                <ActionForm action={reassignStationAction} className="flex gap-2">
                  <input type="hidden" name="id" value={s.id} />
                  <label htmlFor={`cap-${s.id}`} className="sr-only">Capsule</label>
                  <select id={`cap-${s.id}`} name="capsuleId" className="input mt-0 min-h-[44px] flex-1 text-sm">{capsules.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  <Submit className="btn-more min-h-[44px] text-sm">Show this</Submit>
                </ActionForm>
                <form action={stationActiveAction}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="active" value={s.status === 'active' ? 'false' : 'true'} />
                  <button className="btn-quiet w-full text-sm">{s.status === 'active' ? 'Pause this station' : 'Resume this station'}</button></form>
              </div>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <>
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
