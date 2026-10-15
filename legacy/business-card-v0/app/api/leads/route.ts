import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { profile_id, name, email, phone, company, message } = body

    if (!profile_id || !name) {
      return NextResponse.json({ error: 'profile_id and name are required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify profile exists and is active
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', profile_id)
      .eq('is_active', true)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { error } = await supabase.from('leads').insert({
      profile_id,
      name: name.trim().slice(0, 100),
      email: email?.trim().slice(0, 200) ?? null,
      phone: phone?.trim().slice(0, 30) ?? null,
      company: company?.trim().slice(0, 100) ?? null,
      message: message?.trim().slice(0, 1000) ?? null,
      source: 'card_view',
    })

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
