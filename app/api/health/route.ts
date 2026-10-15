import { NextResponse } from 'next/server'
import { getDb } from '@/lib/server/db'

export const dynamic = 'force-dynamic'

/** Liveness + database reachability for uptime monitoring. Reveals no configuration. */
export async function GET() {
  try {
    const db = await getDb()
    await db.query('SELECT 1')
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
