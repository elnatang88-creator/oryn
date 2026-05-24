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

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID ?? 'YOUR_ISSUER_ID'
  const classSuffix = 'oryn_business_card'
  const objectSuffix = profile.username ?? profile.id

  // Google Wallet Generic Pass object structure
  const genericObject = {
    id: `${issuerId}.${objectSuffix}`,
    classId: `${issuerId}.${classSuffix}`,
    genericType: 'GENERIC_TYPE_UNSPECIFIED',
    hexBackgroundColor: '#0A0A0A',
    logo: {
      sourceUri: { uri: `${process.env.NEXT_PUBLIC_APP_URL}/logo.png` },
      contentDescription: { defaultValue: { language: 'en-US', value: 'ORYN' } },
    },
    cardTitle: {
      defaultValue: { language: 'en-US', value: 'ORYN' },
    },
    subheader: {
      defaultValue: { language: 'en-US', value: profile.title ?? 'Digital Business Card' },
    },
    header: {
      defaultValue: { language: 'en-US', value: profile.full_name ?? '' },
    },
    textModulesData: [
      { id: 'company', header: 'COMPANY', body: profile.company ?? '' },
      { id: 'email', header: 'EMAIL', body: profile.email ?? '' },
      { id: 'phone', header: 'PHONE', body: profile.phone ?? '' },
      { id: 'website', header: 'WEBSITE', body: profile.website ?? '' },
    ],
    barcode: {
      type: 'QR_CODE',
      value: `${process.env.NEXT_PUBLIC_APP_URL}/${profile.username}`,
      alternateText: profile.username ?? '',
    },
  }

  // In production: sign this as a JWT with your Google service account key
  // and redirect to: https://pay.google.com/gp/v/save/{jwt}
  return NextResponse.json({
    message: 'Google Wallet integration requires a Google Cloud service account. Configure GOOGLE_WALLET_ISSUER_ID and GOOGLE_SERVICE_ACCOUNT_KEY in .env',
    passObject: genericObject,
    setup: 'https://developers.google.com/wallet',
    saveUrl: `https://pay.google.com/gp/v/save/<signed_jwt>`,
  })
}
