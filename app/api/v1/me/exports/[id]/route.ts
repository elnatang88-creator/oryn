import { NextResponse } from 'next/server'
import { api } from '@/lib/server/api'
import { downloadExport } from '@/lib/server/services/privacy'

export const dynamic = 'force-dynamic'

export const GET = api<{ id: string }>({ auth: true }, async ({ userId, params }) => {
  const payload = await downloadExport(userId!, params.id)
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="oryn-export-${params.id}.json"`, 'Cache-Control': 'private, no-store' },
  })
})
