import { redirect } from 'next/navigation'
import { resolveDestination } from '@/lib/server/services/stations'
import { Unavailable } from '@/components/Recipient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'ORYN', robots: { index: false, follow: false } }

/** Printed station codes land here and are sent on to whatever capsule the station shows today. */
export default async function StationDestination({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const d = await resolveDestination(code)
  if (d.status !== 'ok') return <Unavailable status={d.status} />
  redirect(`/c/${d.token}`)
}
