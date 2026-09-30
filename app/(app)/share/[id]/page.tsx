import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { Clock, Eye } from 'lucide-react'
import { appOrigin, requireUser } from '@/lib/server/request'
import { getShareForOwner } from '@/lib/server/services/sharing'
import { getCapsule } from '@/lib/server/services/capsules'
import { getDb } from '@/lib/server/db'
import { has, userPlan } from '@/lib/server/plans'
import { isFlagOn } from '@/lib/server/services/admin'
import { AppError } from '@/lib/server/errors'
import { revokeShareAction, shareContextAction } from '@/app/actions/sharing'
import { ShareLive } from '@/components/ShareLive'
import { ActionForm, Submit } from '@/components/Forms'
import { timeLeft } from '@/components/CapsuleView'
import { MODE_COPY } from '@/lib/capsule-model'

export const metadata = { title: 'Sharing' }

/** The active sharing screen: built for one hand, bright light and a crowd. The code is the whole point. */
export default async function ActiveSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const share = await getShareForOwner(user.id, id).catch((e) => { if (e instanceof AppError) return null; throw e })
  if (!share) notFound()
  const { capsule } = await getCapsule(user.id, share.capsule_id)
  const url = `${await appOrigin()}/c/${share.token}`
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#011441', light: '#FFFFFF' } })
  const plan = await userPlan(await getDb(), user.id)
  const nfcAllowed = has(plan, 'share.nfc') && (await isFlagOn('share.nfc_tag'))
  const live = share.state === 'live' || share.state === 'opened_once'
  const left = timeLeft(share.expires_at ? new Date(share.expires_at).toISOString() : null)

  return (
    <div className="-mx-4 -my-6 min-h-[calc(100dvh-3.5rem)] overflow-x-hidden bg-navy-900 px-4 py-6 text-white sm:-mx-6 sm:px-6 lg:-my-10 lg:rounded-3xl lg:py-10">
      <div className="mx-auto max-w-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-soft-300">{MODE_COPY[capsule.mode].label} capsule</p>
            <p className="text-xl font-bold">{capsule.name}</p>
          </div>
          <Link href={`/share?capsule=${capsule.id}`} className="btn min-h-[44px] rounded-xl bg-white/10 px-3 text-sm text-white hover:bg-white/15">Switch</Link>
        </div>

        {live ? (
          <>
            <div className="relative mx-auto mt-6 w-full max-w-[300px]">
              <span className="absolute inset-0 animate-pulse-ring rounded-[28px] border-2 border-electric-400" aria-hidden="true" />
              <div className="relative rounded-[28px] bg-white p-4" data-testid="share-qr" role="img" aria-label="QR code for your capsule link" dangerouslySetInnerHTML={{ __html: svg }} />
            </div>
            <p className="mt-4 text-center text-[15px] text-soft-200">Let them scan it. They see only what you chose.</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2 text-[13px] font-semibold">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1" data-testid="share-opens"><Eye className="h-3.5 w-3.5" aria-hidden="true" /> Opened {share.view_count} {share.view_count === 1 ? 'time' : 'times'}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> {left ?? 'Open until you stop it'}</span>
              {share.one_time && <span className="rounded-full bg-white/10 px-3 py-1">{share.state === 'opened_once' ? 'Opened by one person' : 'Opens once'}</span>}
            </div>
            <div className="mt-6"><ShareLive url={url} name={capsule.display_name} nfcAllowed={nfcAllowed} /></div>
            <p className="mt-3 break-all text-center text-xs text-soft-300" data-testid="share-url">{url}</p>

            <ActionForm action={shareContextAction} className="mt-6 rounded-2xl bg-white/5 p-4">
              <input type="hidden" name="id" value={share.id} />
              <label htmlFor="context" className="text-sm font-semibold">Where are you? <span className="font-normal text-soft-300">Only you see this.</span></label>
              <div className="mt-2 flex gap-2">
                <input dir="auto" id="context" name="context" defaultValue={share.context_label} maxLength={80} placeholder="Coffee line, Hall B…" className="input mt-0 flex-1 border-white/15 bg-navy-800 text-white placeholder:text-soft-300/60" />
                <Submit className="btn min-h-[48px] rounded-xl bg-white/15 px-4 text-sm text-white">Save</Submit>
              </div>
            </ActionForm>

            <form action={revokeShareAction} className="mt-6">
              <input type="hidden" name="id" value={share.id} />
              <input type="hidden" name="back" value={`/share/${share.id}`} />
              <button className="btn w-full border border-white/20 text-white hover:bg-white/10" data-testid="stop-sharing">Stop sharing this link</button>
              <p className="mt-2 text-center text-xs text-soft-300">The link closes immediately, even for people who already opened it.</p>
            </form>
          </>
        ) : (
          <div className="mt-10 rounded-3xl bg-white/5 p-6 text-center" data-testid="share-stopped">
            <p className="text-lg font-bold">{share.state === 'stopped' ? 'This link is closed.' : 'This link has expired.'}</p>
            <p className="mt-1 text-soft-200">Nobody can open it anymore. It was opened {share.view_count} {share.view_count === 1 ? 'time' : 'times'}.</p>
            <Link href={`/share?capsule=${capsule.id}`} className="btn-share mt-6 w-full">Start a new share</Link>
            <Link href="/today" className="btn mt-2 w-full text-soft-200">Back to Today</Link>
          </div>
        )}
      </div>
    </div>
  )
}
