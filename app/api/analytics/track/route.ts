import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getDeviceType, getBrowser } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const { profile_id } = await req.json()
    if (!profile_id) return NextResponse.json({ error: 'Missing profile_id' }, { status: 400 })

    const ua = req.headers.get('user-agent') ?? ''
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const referrer = req.headers.get('referer') ?? null

    const supabase = await createClient()
    await supabase.from('card_views').insert({
      profile_id,
      viewer_ip: ip,
      viewer_device: getDeviceType(ua),
      viewer_browser: getBrowser(ua),
      referrer,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
