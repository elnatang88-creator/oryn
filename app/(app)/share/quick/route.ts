import type { NextRequest } from 'next/server'
import { currentUser } from '@/lib/server/request'
import { quickShare } from '@/lib/server/services/sharing'
import { defaultCapsuleId } from '@/lib/server/services/capsules'
import { relativeRedirect } from '@/lib/server/redirect'
import type { Channel } from '@/lib/capsule-model'

export const dynamic = 'force-dynamic'

/** One tap from anywhere (tab bar, PWA shortcut, OS automation) to a live share of the default capsule. */
export async function GET(req: NextRequest) {
  const user = await currentUser()
  if (!user) return relativeRedirect('/signin?next=%2Fshare%2Fquick')
  if (!(await defaultCapsuleId(user.id))) return relativeRedirect('/capsules/new')
  const via = req.nextUrl.searchParams.get('via') === 'shortcut' ? 'shortcut' : 'qr'
  const { id } = await quickShare(user.id, via as Channel)
  const then = req.nextUrl.searchParams.get('then')
  return relativeRedirect(`/share/${id}${then === 'present' ? '/present' : then === 'qr' ? '/qr' : then === 'first' ? '?first=1' : ''}`)
}
