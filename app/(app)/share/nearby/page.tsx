import { requireUser } from '@/lib/server/request'
import { getNearbySettings } from '@/lib/server/services/nearby'
import { NearbyScreen } from '@/components/nearby/NearbyUI'

export const metadata = { title: 'Nearby' }

export default async function NearbyPage() {
  const user = await requireUser()
  const s = await getNearbySettings(user.id)
  // Present goes through the quick share (reuses today's link), never a prefetch.
  return <NearbyScreen initialVisibility={s.visibility} events={s.events} presentHref="/share/quick?then=present" />
}
