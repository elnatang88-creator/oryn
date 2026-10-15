import { NextResponse } from 'next/server'
import { api } from '@/lib/server/api'
import { listRegistrations, toCsv } from '@/lib/server/services/registrations'

export const dynamic = 'force-dynamic'

/** Staff only. `?q=` searches; `?format=csv` downloads (quoted, formula-safe). */
export const GET = api<{ id: string }>({ auth: true }, async ({ req, params, userId }) => {
  const rows = await listRegistrations(userId!, params.id, req.nextUrl.searchParams.get('q') ?? '')
  if (req.nextUrl.searchParams.get('format') === 'csv') {
    const csv = toCsv(rows as unknown as Record<string, unknown>[], ['name', 'email', 'company', 'status', 'ticket_type_id', 'checked_in_at', 'created_at'])
    return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="registrations-${params.id}.csv"`, 'cache-control': 'private, no-store' } })
  }
  return rows
})
