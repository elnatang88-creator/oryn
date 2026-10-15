import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

interface Props {
  params: Promise<{ username: string }>
}

export async function GET(req: NextRequest, { params }: Props) {
  const { username } = await params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const cardUrl = `${appUrl}/${username}`

  const png = await QRCode.toBuffer(cardUrl, {
    type: 'png',
    width: 400,
    margin: 2,
    color: {
      dark: '#0A0A0A',
      light: '#F5F0E8',
    },
    errorCorrectionLevel: 'H',
  })

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
    },
  })
}
