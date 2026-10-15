import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { loadOwnerShare } from '../load'
import { ShareAnotherWay } from '@/components/ShareAnotherWay'
import { CopyLink } from '@/components/CopyLink'
import { TrackOnMount } from '@/components/TrackOnMount'

export const metadata = { title: 'QR code' }

/** QR mode: only here does the code become large. QR is a transport, not the product. */
export default async function QrModePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { share, capsule, url, svg, live } = await loadOwnerShare(id)
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-[max(env(safe-area-inset-top),1rem)] text-ink">
      <TrackOnMount name="qr_opened" props={{ card_id: capsule.id, surface: 'qr' }} />
      <Link href={`/share/${share.id}`} className="btn-quiet -ml-2 self-start" data-testid="qr-back"><ChevronLeft className="h-5 w-5" aria-hidden="true" /> My card</Link>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center py-6">
        {live ? (
          <>
            <h1 className="text-center text-2xl font-bold text-navy-900">Scan to open my ORYN card</h1>
            <p className="mt-1 text-center text-[15px] text-ink-muted">{capsule.display_name} · no app needed</p>
            <div className="mt-6 w-full max-w-[320px] rounded-3xl bg-white p-3 shadow-lift ring-1 ring-soft-200" role="img" aria-label="QR code that opens this card" data-testid="share-qr" dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="mt-6 grid w-full grid-cols-2 gap-2">
              <CopyLink url={url} />
              <div className="[&_button]:min-h-[52px] [&_button]:rounded-2xl [&_button]:bg-soft-100 [&_button]:text-navy-900"><ShareAnotherWay url={url} name={capsule.display_name} qrHref={`/share/${share.id}/qr`} /></div>
            </div>
          </>
        ) : (
          <p className="rounded-2xl bg-soft-50 p-6 text-center" data-testid="share-stopped">This link is closed, so there is no code to show.</p>
        )}
      </div>
    </div>
  )
}
