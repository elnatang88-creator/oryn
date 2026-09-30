import Link from 'next/link'
import { ChevronDown, Clock, Eye, Maximize2, QrCode, Radar, Wallet } from 'lucide-react'
import { getDb } from '@/lib/server/db'
import { has, userPlan } from '@/lib/server/plans'
import { isFlagOn } from '@/lib/server/services/admin'
import { revokeShareAction, shareContextAction } from '@/app/actions/sharing'
import { ShareLive } from '@/components/ShareLive'
import { ShareAnotherWay } from '@/components/ShareAnotherWay'
import { ActionForm, Submit } from '@/components/Forms'
import { timeLeft } from '@/components/CapsuleView'
import { CardFace, DesignedBack } from '@/components/LuxuryCard'
import { CardStage } from '@/components/CardStage'
import { LiveRefresh } from '@/components/LiveRefresh'
import { loadOwnerShare } from './load'
import { NearbyDock } from '@/components/nearby/NearbyUI'
import { getNearbySettings } from '@/lib/server/services/nearby'
import { listCapsules, getCapsule } from '@/lib/server/services/capsules'
import { cardFor } from '@/lib/server/services/owner-card'
import { CardSwitcher } from '@/components/CardSwitcher'
import { TrackOnMount } from '@/components/TrackOnMount'

export const metadata = { title: 'My card' }

/**
 * Share = opening your ORYN wallet. The first thing on screen is your card, exactly as designed in Card
 * Studio. Nearby and Present are the two primary ways to give it; QR is one of several fallbacks.
 */
export default async function WalletSharePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ first?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const first = sp.first === '1'
  const { user, share, capsule, url, svg, live, design, identity, details } = await loadOwnerShare(id)
  const cards = await Promise.all((await listCapsules(user.id)).map(async (c) => { const full = (await getCapsule(user.id, c.id)).capsule; const f = cardFor(full); return { id: c.id, name: c.name, mode: c.mode, design: f.design, identity: f.identity } }))
  const plan = await userPlan(await getDb(), user.id)
  const nfcAllowed = has(plan, 'share.nfc') && (await isFlagOn('share.nfc_tag'))
  const nearby = await getNearbySettings(user.id)
  const left = timeLeft(share.expires_at ? new Date(share.expires_at).toISOString() : null)

  return (
    <div className="entry-stage -mx-4 -my-6 min-h-[calc(100dvh-3.5rem)] overflow-x-hidden px-4 pb-10 pt-4 text-white sm:-mx-6 sm:px-6 lg:-my-10 lg:rounded-3xl lg:py-10">
      <div className="mx-auto max-w-sm">
        <TrackOnMount name="share_opened" props={{ card_id: capsule.id, surface: first ? 'first_run' : 'share' }} />
        {first ? (
          <div className="text-center" data-testid="first-run">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-electric-300">Your card is ready</p>
            <h1 className="mt-1 text-2xl font-bold">This is you on ORYN</h1>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <CardSwitcher activeId={capsule.id} activeName={capsule.name} cards={cards} />
            {live && (
              <Link href={`/share/${share.id}/qr`} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/15" aria-label="Show QR code" data-testid="open-qr">
                <QrCode className="h-5 w-5" aria-hidden="true" />
              </Link>
            )}
          </div>
        )}

        <div className="mx-auto mt-3 w-full max-w-[360px]" data-testid="wallet-card">
          <CardStage rise surface={first ? 'first_run' : 'share'} front={<CardFace design={design} identity={identity} nameTestId="wallet-card-name" />}
            back={<DesignedBack design={design} qrSvg={svg} name={capsule.display_name} details={details} qrTestId="card-back-qr" />} />
        </div>
        {live && <NearbyDock initialVisibility={nearby.visibility} myCard={{ ...identity, design }} />}

        {live ? (
          <>
            {first && <p className="mt-5 text-center text-sm text-soft-200">Three ways to give it:</p>}
            <div className={`${first ? 'mt-3' : 'mt-5'} grid grid-cols-2 gap-3`}>
              <Link href="/share/nearby" className="btn-share min-h-[60px] rounded-2xl text-[16px]" data-testid="open-nearby"><Radar className="h-5 w-5" aria-hidden="true" /> {first ? 'Find someone' : 'Nearby'}</Link>
              <Link href={`/share/${share.id}/present`} className="btn min-h-[60px] rounded-2xl bg-white text-[16px] text-navy-900 hover:bg-soft-100" data-testid="open-present"><Maximize2 className="h-5 w-5" aria-hidden="true" /> Present card</Link>
            </div>
            <Link href={`/share/${share.id}/wallet`} className="btn mt-3 min-h-[52px] w-full rounded-2xl border border-white/15 bg-white/5 text-[15px] text-white hover:bg-white/10" data-testid="open-wallet"><Wallet className="h-5 w-5" aria-hidden="true" /> Add to Wallet</Link>
            <div className="mt-2"><ShareAnotherWay url={url} name={capsule.display_name} qrHref={`/share/${share.id}/qr`} /></div>
            {first && <p className="mt-2 text-center"><Link href={`/capsules/${capsule.id}`} className="text-sm font-semibold text-soft-200 underline-offset-4 hover:underline">Edit card</Link></p>}

            <div className="mt-4 flex flex-wrap justify-center gap-2 text-[13px] font-semibold">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1" data-testid="share-opens"><Eye className="h-3.5 w-3.5" aria-hidden="true" /> Opened {share.view_count} {share.view_count === 1 ? 'time' : 'times'}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> {left ?? 'Open until you stop it'}</span>
              {share.one_time && <span className="rounded-full bg-white/10 px-3 py-1">{share.state === 'opened_once' ? 'Opened by one person' : 'Opens once'}</span>}
            </div>

            <details className="mt-6 rounded-2xl bg-white/5 p-4 [&_summary::-webkit-details-marker]:hidden" data-testid="link-settings">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between text-sm font-semibold">Link settings <ChevronDown className="h-4 w-4" aria-hidden="true" /></summary>
              <p className="mt-2 break-all text-xs text-soft-300" data-testid="share-url">{url}</p>
              <ActionForm action={shareContextAction} className="mt-4">
                <input type="hidden" name="id" value={share.id} />
                <label htmlFor="context" className="text-sm font-semibold">Where are you? <span className="font-normal text-soft-300">Only you see this.</span></label>
                <div className="mt-2 flex gap-2">
                  <input dir="auto" id="context" name="context" defaultValue={share.context_label} maxLength={80} placeholder="Coffee line, Hall B…" className="input mt-0 flex-1 border-white/15 bg-navy-800 text-white placeholder:text-soft-300/60" />
                  <Submit className="btn min-h-[48px] rounded-xl bg-white/15 px-4 text-sm text-white">Save</Submit>
                </div>
              </ActionForm>
              {nfcAllowed && <div className="mt-4"><ShareLive url={url} name={capsule.display_name} nfcAllowed={nfcAllowed} nfcOnly /></div>}
              <form action={revokeShareAction} className="mt-4">
                <input type="hidden" name="id" value={share.id} />
                <input type="hidden" name="back" value={`/share/${share.id}`} />
                <button className="btn w-full border border-white/20 text-white hover:bg-white/10" data-testid="stop-sharing">Stop sharing this link</button>
                <p className="mt-2 text-center text-xs text-soft-300">The link closes immediately, even for people who already opened it.</p>
              </form>
            </details>
            <LiveRefresh every={10000} />
          </>
        ) : (
          <div className="mt-8 rounded-3xl bg-white/5 p-6 text-center" data-testid="share-stopped">
            <p className="text-lg font-bold">{share.state === 'stopped' ? 'This link is closed.' : 'This link has expired.'}</p>
            <p className="mt-1 text-soft-200">Nobody can open it anymore. It was opened {share.view_count} {share.view_count === 1 ? 'time' : 'times'}.</p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- starts a share, so it must never be prefetched */}
            <a href="/share/quick" className="btn-share mt-6 w-full">Open my card again</a>
            <Link href={`/share?capsule=${capsule.id}`} className="btn mt-2 w-full text-soft-200">Start a custom share</Link>
          </div>
        )}
      </div>
    </div>
  )
}
