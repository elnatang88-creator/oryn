import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get('id')
  if (!profileId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', profileId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Full Apple Wallet PKPass generation requires Apple Developer certificates.
  // This endpoint returns a guide JSON showing the pass structure.
  // In production, integrate with a library like `passkit-generator` with real certs.
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID ?? 'pass.com.oryn.card',
    serialNumber: profile.id,
    teamIdentifier: process.env.APPLE_TEAM_ID ?? 'XXXXXXXXXX',
    webServiceURL: `${process.env.NEXT_PUBLIC_APP_URL}/api/wallet/apple`,
    authenticationToken: Buffer.from(profile.id).toString('base64'),
    organizationName: 'ORYN',
    description: `${profile.full_name} — Digital Business Card`,
    backgroundColor: 'rgb(10,10,10)',
    foregroundColor: 'rgb(201,168,76)',
    labelColor: 'rgb(139,115,64)',
    logoText: 'ORYN',
    generic: {
      primaryFields: [{ key: 'name', label: 'NAME', value: profile.full_name ?? '' }],
      secondaryFields: [
        { key: 'title', label: 'TITLE', value: profile.title ?? '' },
        { key: 'company', label: 'COMPANY', value: profile.company ?? '' },
      ],
      auxiliaryFields: [
        { key: 'email', label: 'EMAIL', value: profile.email ?? '' },
        { key: 'phone', label: 'PHONE', value: profile.phone ?? '' },
      ],
      backFields: [
        { key: 'website', label: 'WEBSITE', value: profile.website ?? '' },
        { key: 'linkedin', label: 'LINKEDIN', value: profile.linkedin_url ?? '' },
        { key: 'card_url', label: 'CARD URL', value: `${process.env.NEXT_PUBLIC_APP_URL}/${profile.username}` },
      ],
    },
  }

  // Return the pass.json structure (in production this would be packaged into a .pkpass bundle)
  return NextResponse.json({
    message: 'Apple Wallet integration requires Apple Developer certificates. Configure APPLE_CERT_PEM, APPLE_KEY_PEM, APPLE_WWDR_PEM in .env',
    passStructure: passJson,
    setup: 'https://developer.apple.com/documentation/walletpasses',
  })
}
