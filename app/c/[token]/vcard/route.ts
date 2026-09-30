import { NextResponse, type NextRequest } from 'next/server'
import { recipientVcard } from '@/lib/server/services/sharing'

export const dynamic = 'force-dynamic'

/** "Save" — a vCard with only the details the recipient was allowed to see. No account needed. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = await recipientVcard(token, req.cookies.get('oryn_claim')?.value ?? null)
  if (r.status !== 'ok') return NextResponse.redirect(new URL(`/c/${token}`, req.url), 303)
  return new NextResponse(r.vcard, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(r.filename)}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
