import { NextResponse } from 'next/server'
import { api } from '@/lib/server/api'
import { exportLeadsCsv } from '@/lib/server/services/crm'

export const dynamic = 'force-dynamic'

export const GET = api<{ id: string }>({ auth: true }, async ({ params, userId }) => {
  const csv = await exportLeadsCsv(userId!, params.id)
  return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="leads-${params.id}.csv"`, 'cache-control': 'private, no-store' } })
})
