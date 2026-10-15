'use server'

import { redirect } from 'next/navigation'
import { currentUser, requestContext } from '@/lib/server/request'
import { registerForEvent, cancelRegistration } from '@/lib/server/services/registrations'
import { createLead } from '@/lib/server/services/crm'
import { resolveStation } from '@/lib/server/services/stations'
import { run, str, bool } from './run'
import type { ActionState } from './types'

/** Public event registration. Works without an account; a signed-in member is linked to their registration. */
export async function registerAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const me = await currentUser()
    const ctx = await requestContext()
    const answers: Record<string, string | boolean> = {}
    for (const [k, v] of fd.entries()) if (k.startsWith('q_')) answers[k.slice(2)] = typeof v === 'string' ? (v === 'on' ? true : v) : ''
    const station = str(fd, 'station')
    let stationId: string | null = null
    if (station) { const s = await resolveStation(station); if (s.status === 'ok') stationId = s.stationId }
    const r = await registerForEvent(str(fd, 'slug'), { name: str(fd, 'name'), email: str(fd, 'email'), company: str(fd, 'company'), ticketTypeId: str(fd, 'ticketType') || undefined, answers }, { ipKey: ctx.ipKey, userId: me?.id ?? null, stationId })
    redirect(`/ticket/${r.token}?${r.already ? 'again=1' : 'new=1'}`)
  })
}

export async function cancelRegistrationAction(fd: FormData) {
  const token = str(fd, 'token')
  try { await cancelRegistration(token) } catch { /* shown on the ticket page */ }
  redirect(`/ticket/${token}?cancelled=1`)
}

/** Lead capture at a station or booth. Consent is required; the person decides what to leave. */
export async function submitLeadAction(_: ActionState, fd: FormData) {
  return run(async () => {
    const ctx = await requestContext()
    const s = await resolveStation(str(fd, 'station'))
    if (s.status !== 'ok' || s.mode !== 'lead') throw new Error('This station no longer accepts details.')
    await createLead(s.orgId, { name: str(fd, 'name'), email: str(fd, 'email'), phone: str(fd, 'phone'), company: str(fd, 'company'), message: str(fd, 'message'), consent: bool(fd, 'consent'), eventId: s.eventId, stationId: s.stationId, source: 'station' }, { ipKey: ctx.ipKey })
    return `Thanks — ${s.orgName} has your details and will be in touch.`
  })
}
