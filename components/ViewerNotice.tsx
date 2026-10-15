import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

/** Told before anything else: a signed-in member's view is visible to the owner (unless they browse privately). */
export function ViewerNotice({ viewerName, ownerFirst, visible }: { viewerName: string; ownerFirst: string; visible: boolean }) {
  return (
    <p className="mb-3 flex items-start gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-ink shadow-lift" role="note" data-testid="viewer-notice">
      {visible ? <Eye className="mt-0.5 h-4 w-4 shrink-0 text-electric" aria-hidden="true" /> : <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />}
      <span>
        {visible
          ? <>You’re signed in as <bdi className="font-semibold">{viewerName}</bdi>. <bdi>{ownerFirst}</bdi> can see that you viewed this.</>
          : <>You’re viewing privately. <bdi>{ownerFirst}</bdi> won’t see your name.</>}
        {' '}<Link href="/settings/profile" className="font-semibold text-electric-600 underline">Change</Link>
      </span>
    </p>
  )
}
