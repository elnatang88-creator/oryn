import type { NextRequest } from 'next/server'
import { currentUser } from '@/lib/server/request'
import { quickShare } from '@/lib/server/services/sharing'
import { setDefaultCapsule } from '@/lib/server/services/capsules'
import { relativeRedirect } from '@/lib/server/redirect'
import { AppError } from '@/lib/server/errors'

export const dynamic = 'force-dynamic'

/** Make a card the active one (Nearby, Present, Wallet and the Share button all use it) and open it. */
export async function GET(req: NextRequest) {
  const user = await currentUser()
  if (!user) return relativeRedirect('/signin?next=%2Fshare%2Fquick')
  const id = req.nextUrl.searchParams.get('capsule') ?? ''
  try { await setDefaultCapsule(user.id, id) } catch (e) { if (!(e instanceof AppError)) throw e; return relativeRedirect('/share/quick') }
  const { id: shareId } = await quickShare(user.id)
  return relativeRedirect(`/share/${shareId}`)
}
