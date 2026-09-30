import { requireUser } from '@/lib/server/request'
import { getNearbySettings } from '@/lib/server/services/nearby'
import { NearbyScreen } from '@/components/nearby/NearbyUI'
import { defaultCapsuleId, getCapsule } from '@/lib/server/services/capsules'
import { cardFor } from '@/lib/server/services/owner-card'

export const metadata = { title: 'Nearby' }

export default async function NearbyPage() {
  const user = await requireUser()
  const s = await getNearbySettings(user.id)
  const capId = await defaultCapsuleId(user.id)
  const mine = capId ? cardFor((await getCapsule(user.id, capId)).capsule) : null
  const myCard = mine ? { ...mine.identity, design: mine.design } : null
  // Present goes through the quick share (reuses today's link), never a prefetch.
  return <NearbyScreen initialVisibility={s.visibility} events={s.events} presentHref="/share/quick?then=present" myCard={myCard} />
}
