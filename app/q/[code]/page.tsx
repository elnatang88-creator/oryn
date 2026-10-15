import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'ORYN', robots: { index: false, follow: false } }

/** Printed codes from before stations had modes. Same code, same behaviour: it's an alias of /s/<code>. */
export default async function StationAlias({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  redirect(`/s/${encodeURIComponent(code)}`)
}
