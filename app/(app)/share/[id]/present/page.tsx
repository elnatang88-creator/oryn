import { loadOwnerShare } from '../load'
import { PresentView } from '@/components/PresentView'
import { CardFace, DesignedBack } from '@/components/LuxuryCard'

export const metadata = { title: 'Present my card' }

export default async function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { share, capsule, url, svg, design, identity } = await loadOwnerShare(id)
  return (
    <PresentView url={url} name={capsule.display_name} closeHref={`/share/${share.id}`} qrHref={`/share/${share.id}/qr`}
      front={<CardFace design={design} identity={identity} nameTestId="present-card-name" />}
      back={<DesignedBack design={design} qrSvg={svg} name={capsule.display_name} qrTestId="present-back-qr" />} />
  )
}
