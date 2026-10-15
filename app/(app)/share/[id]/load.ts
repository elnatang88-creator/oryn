import 'server-only'
import { notFound } from 'next/navigation'
import { appOrigin, requireUser } from '@/lib/server/request'
import { getShareForOwner } from '@/lib/server/services/sharing'
import { getCapsule } from '@/lib/server/services/capsules'
import { cardFor, qrSvg } from '@/lib/server/services/owner-card'
import { AppError } from '@/lib/server/errors'

/** Owner-only: the share, its public URL, and the card exactly as designed in Card Studio. */
export async function loadOwnerShare(id: string) {
  const user = await requireUser()
  const share = await getShareForOwner(user.id, id).catch((e) => { if (e instanceof AppError) return null; throw e })
  if (!share) notFound()
  const { capsule } = await getCapsule(user.id, share.capsule_id)
  const url = `${await appOrigin()}/c/${share.token}`
  return { user, share, capsule, url, svg: await qrSvg(url), live: share.state === 'live' || share.state === 'opened_once', ...cardFor(capsule) }
}
