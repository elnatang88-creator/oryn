import { NextResponse, type NextRequest } from 'next/server'
import { runDueJobs, enqueue } from '@/lib/server/jobs'
import { getDb } from '@/lib/server/db'
import { safeEqual } from '@/lib/server/secrets'

export const dynamic = 'force-dynamic'

/** Called by a scheduler (e.g. a platform cron) with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const given = req.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
  if (!secret || !safeEqual(given, secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (req.nextUrl.searchParams.get('daily') === '1') await enqueue(await getDb(), 'followups.remind', {})
  const ran = await runDueJobs(50)
  return NextResponse.json({ ran })
}
