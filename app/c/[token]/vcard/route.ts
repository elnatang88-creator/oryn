import { NextResponse, type NextRequest } from 'next/server'
import { recipientVcard } from '@/lib/server/services/sharing'
import { relativeRedirect } from '@/lib/server/redirect'

export const dynamic = 'force-dynamic'

/** "Save" — a vCard with only the details the recipient was allowed to see. No account needed. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = await recipientVcard(token, req.cookies.get('oryn_claim')?.value ?? null)
  if (r.status !== 'ok') return relativeRedirect(`/c/${encodeURIComponent(token)}`)
  return new NextResponse(r.vcard, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      // ASCII fallback + RFC 5987 UTF-8 name, so Hebrew (and any script) names survive the download.
      'Content-Disposition': `attachment; filename="contact.vcf"; filename*=UTF-8''${encodeURIComponent(r.filename)}`,
      'Cache-Control': 'private, no-store',
    },
  })
}
