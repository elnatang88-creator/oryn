import { NextResponse, type NextRequest } from 'next/server'
import { currentUser } from '@/lib/server/request'
import { quickShare } from '@/lib/server/services/sharing'
import { defaultCapsuleId } from '@/lib/server/services/capsules'
import type { Channel } from '@/lib/capsule-model'

export const dynamic = 'force-dynamic'

/** One tap from anywhere (tab bar, PWA shortcut, OS automation) to a live share of the default capsule. */
export async function GET(req: NextRequest) {
  const user = await currentUser()
  const url = req.nextUrl.clone()
  url.search = ''
  if (!user) {
    url.pathname = '/signin'
    url.searchParams.set('next', '/share/quick')
    return NextResponse.redirect(url, 303)
  }
  if (!(await defaultCapsuleId(user.id))) {
    url.pathname = '/capsules/new'
    return NextResponse.redirect(url, 303)
  }
  const via = req.nextUrl.searchParams.get('via') === 'shortcut' ? 'shortcut' : 'qr'
  const { id } = await quickShare(user.id, via as Channel)
  url.pathname = `/share/${id}`
  return NextResponse.redirect(url, 303)
}
