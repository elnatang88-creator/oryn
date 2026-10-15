import { describe, expect, it } from 'vitest'
import { makeUser, fields, db } from './helpers'
import { createOrg, addMember } from '@/lib/server/services/orgs'
import { createEvent } from '@/lib/server/services/events'
import { createCapsule } from '@/lib/server/services/capsules'
import { updateEventDetails, publicEvent, registerForEvent, ticketByToken, cancelRegistration, checkIn, registrationStats, listRegistrations, toCsv } from '@/lib/server/services/registrations'
import { createLead, listLeads, updateLead, addLeadNote, createTask, listTasks, exportLeadsCsv, pipelineSummary, setPipelineStages } from '@/lib/server/services/crm'
import { createAutomation, fireTrigger, listRuns, fireDueTasks } from '@/lib/server/services/automations'
import { createStation, configureStation, resolveStation, safeExternalUrl, startStationTransfer, acceptStationTransfer, stationAnalytics } from '@/lib/server/services/stations'
import { sendVerificationEmail, verifyEmailToken, requestPasswordReset, resetPasswordWithToken, signIn, setUsername } from '@/lib/server/services/auth'
import { deliverEmail } from '@/lib/server/email'
import { runDueJobs } from '@/lib/server/jobs'
import { globalSearch } from '@/lib/server/services/search'
import { runAi } from '@/lib/server/ai'
import { AppError } from '@/lib/server/errors'

const ctx = (ip: string) => ({ ipKey: ip })

async function organizer() {
  const u = await makeUser('business', 'Organizer One')
  const orgId = await createOrg(u.id, 'Carmel Ventures')
  const eventId = await createEvent(u.id, orgId, { name: 'Carmel Summit', venue: 'Pier 9' })
  return { u, orgId, eventId }
}

describe('event registration, tickets and check-in', () => {
  it('publishes a public page, registers (atomic capacity + waitlist), issues a signed ticket, promotes from the waitlist on cancel', async () => {
    const { u, eventId } = await organizer()
    expect(await publicEvent('carmel-summit')).toBeNull() // not published yet
    const slug = await updateEventDetails(u.id, eventId, { slug: 'Carmel Summit', description: 'A day of founders', capacity: 2, published: true, registrationFields: [{ id: 'diet', label: 'Dietary needs', kind: 'select', required: true, options: ['None', 'Vegan'] }] })
    expect(slug).toBe('carmel-summit')
    const pub = await publicEvent('carmel-summit')
    expect(pub?.org_name).toBe('Carmel Ventures')

    await expect(registerForEvent('carmel-summit', { name: 'No Diet', email: 'a@example.com', answers: {} }, ctx('r1'))).rejects.toThrow('required')
    const a = await registerForEvent('carmel-summit', { name: 'Ada A', email: 'ada@example.com', answers: { diet: 'Vegan' } }, ctx('r1'))
    const b = await registerForEvent('carmel-summit', { name: 'Ben B', email: 'ben@example.com', answers: { diet: 'None' } }, ctx('r2'))
    const c = await registerForEvent('carmel-summit', { name: 'Cy C', email: 'cy@example.com', answers: { diet: 'None' } }, ctx('r3'))
    expect([a.status, b.status, c.status]).toEqual(['confirmed', 'confirmed', 'waitlisted'])
    // Same email again: no second ticket, same registration.
    const again = await registerForEvent('carmel-summit', { name: 'Ada Again', email: 'ada@example.com', answers: { diet: 'Vegan' } }, ctx('r1'))
    expect(again.already).toBe(true)
    expect(again.registrationId).toBe(a.registrationId)

    const t = await ticketByToken(a.token)
    expect(t?.name).toBe('Ada A')
    expect(await ticketByToken(a.token.slice(0, -2) + 'zz')).toBeNull() // tampered signature
    expect(await ticketByToken('reg_doesnotexist.abcdefghijklmnopqrstuv')).toBeNull()

    // Emails were queued (ticket, waitlist) and delivered through the outbox (log transport).
    const d = await db()
    const mails = await d.query<{ kind: string; status: string; to_email: string }>(`SELECT kind, status, to_email FROM email_outbox WHERE to_email IN ('ada@example.com','cy@example.com') ORDER BY created_at`)
    expect(mails.map((m) => m.kind)).toEqual(expect.arrayContaining(['ticket', 'registration_waitlisted']))
    process.env.EMAIL_TRANSPORT = 'log'
    const log = console.log; console.log = () => {}
    try { await runDueJobs(50) } finally { console.log = log; process.env.EMAIL_TRANSPORT = 'none' }
    expect((await d.query<{ status: string }>(`SELECT status FROM email_outbox WHERE to_email = 'ada@example.com'`)).every((m) => m.status === 'sent')).toBe(true)

    // Ada cancels → Cy is promoted off the waitlist.
    await cancelRegistration(a.token)
    expect((await ticketByToken(a.token))?.status).toBe('cancelled')
    expect((await ticketByToken(c.token))?.status).toBe('confirmed')
    await expect(cancelRegistration(a.token)).rejects.toThrow()
    const s = await registrationStats(u.id, eventId)
    expect(s).toMatchObject({ confirmed: 2, waitlisted: 0, cancelled: 1, checked_in: 0 })
  })

  it('check-in is atomic and staff-only; a ticket is admitted once; cancelled and waitlisted are refused', async () => {
    const { u, eventId } = await organizer()
    await updateEventDetails(u.id, eventId, { slug: 'checkin-test', published: true, capacity: 1 })
    const ok = await registerForEvent('checkin-test', { name: 'Door Person', email: 'door@example.com', answers: {} }, ctx('c1'))
    const wl = await registerForEvent('checkin-test', { name: 'Waiting Person', email: 'wait@example.com', answers: {} }, ctx('c2'))
    const stranger = await makeUser('pro', 'Stranger')
    await expect(checkIn(stranger.id, eventId, ok.token, 'scan')).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'not_found')
    // Two scanners at once: exactly one wins.
    const results = await Promise.all([checkIn(u.id, eventId, `https://oryn.test/ticket/${ok.token}`, 'scan'), checkIn(u.id, eventId, ok.token, 'scan')])
    expect(results.map((r) => r.status).sort()).toEqual(['already', 'ok'])
    expect(await checkIn(u.id, eventId, wl.token, 'scan')).toMatchObject({ status: 'waitlisted' })
    expect(await checkIn(u.id, eventId, 'garbage', 'scan')).toEqual({ status: 'not_found' })
    const manual = await checkIn(u.id, eventId, ok.registrationId, 'manual')
    expect(manual.status).toBe('already')
    expect((await ticketByToken(ok.token))?.checked_in_at).toBeTruthy()
    // A member of another workspace cannot see these registrations.
    const other = await makeUser('business', 'Other Org Owner')
    await createOrg(other.id, 'Other')
    await expect(listRegistrations(other.id, eventId)).rejects.toThrow()
    const csv = toCsv([{ name: '=cmd()', email: 'x@y' }], ['name', 'email'])
    expect(csv).toContain(`"'=cmd()"`)
  })
})

describe('stations v2', () => {
  it('modes resolve correctly; only https destinations; transfer needs the one-time code', async () => {
    const { u, orgId, eventId } = await organizer()
    const cap = await createCapsule(u.id, { name: 'Booth', mode: 'professional', display_name: 'Organizer One', fields: fields() })
    const { stationId, code } = await createStation(u.id, orgId, { name: 'Booth 1', kind: 'booth', capsuleId: cap, eventId })
    expect((await resolveStation(code)) as { mode: string }).toMatchObject({ status: 'ok', mode: 'card' })
    await expect(configureStation(u.id, stationId, { mode: 'link', destinationUrl: 'http://insecure.example' })).rejects.toThrow('https')
    await expect(configureStation(u.id, stationId, { mode: 'link', destinationUrl: 'https://10.0.0.1/admin' })).rejects.toThrow('https')
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    await configureStation(u.id, stationId, { mode: 'booking', destinationUrl: 'https://cal.example/team', headline: 'Book us' })
    expect(await resolveStation(code)).toMatchObject({ status: 'ok', mode: 'booking', destinationUrl: 'https://cal.example/team' })
    await updateEventDetails(u.id, eventId, { slug: 'station-ev', published: true })
    await configureStation(u.id, stationId, { mode: 'registration', eventId })
    expect(await resolveStation(code)).toMatchObject({ mode: 'registration', eventSlug: 'station-ev' })
    await configureStation(u.id, stationId, { mode: 'lead' })
    // Scans are counted without personal data.
    const stats = await stationAnalytics(u.id, orgId)
    expect(stats[0].scans).toBeGreaterThanOrEqual(3)
    // Transfer.
    const receiver = await makeUser('business', 'Receiver')
    const toOrg = await createOrg(receiver.id, 'Receiving Co')
    await expect(acceptStationTransfer(receiver.id, toOrg, 'nope')).rejects.toThrow()
    const outsider = await makeUser('pro', 'Outsider')
    await expect(startStationTransfer(outsider.id, stationId)).rejects.toThrow()
    const tcode = await startStationTransfer(u.id, stationId)
    expect(await acceptStationTransfer(receiver.id, toOrg, tcode)).toBe(stationId)
    await expect(acceptStationTransfer(receiver.id, toOrg, tcode)).rejects.toThrow() // one-time
    const d = await db()
    expect((await d.query<{ org_id: string }>(`SELECT org_id FROM stations WHERE id = $1`, [stationId]))[0].org_id).toBe(toOrg)
  })
})

describe('CRM and automations', () => {
  it('leads need consent from the public, flow through the pipeline, and automations run once per subject with retries logged', async () => {
    const { u, orgId, eventId } = await organizer()
    const rep = await makeUser('pro', 'Sales Rep')
    await addMember(u.id, orgId, { email: rep.email, role: 'member' })
    const autoId = await createAutomation(u.id, orgId, { name: 'Follow up station leads', trigger: 'lead.created', conditions: { source: 'station' }, actions: [
      { type: 'assign_lead', userId: rep.id }, { type: 'create_task', title: 'Call within 24h', dueInDays: 1, assignee: 'assignee' }, { type: 'notify', to: 'managers', body: 'Booth lead' }, { type: 'send_email', to: 'lead', subject: 'Thanks {name}', text: 'Hi {name}, good to meet you.' },
    ] })
    await expect(createLead(orgId, { name: 'No Consent', email: 'nc@example.com', consent: false, source: 'station' }, { ipKey: 'l1' })).rejects.toThrow('agree')
    const leadId = await createLead(orgId, { name: 'Visitor V', email: 'v@example.com', company: 'Visitor Co', consent: true, source: 'station', eventId }, { ipKey: 'l1' })
    await runDueJobs(50)
    const runs = await listRuns(u.id, orgId)
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({ status: 'done', trigger: 'lead.created' })
    const [lead] = await listLeads(u.id, orgId, { q: 'Visitor' })
    expect(lead.assignee_user_id).toBe(rep.id)
    expect(lead.open_tasks).toBe(1)
    const d = await db()
    expect(await d.query(`SELECT 1 FROM notifications WHERE user_id = $1 AND kind = 'automation'`, [u.id])).toHaveLength(1)
    expect(await d.query(`SELECT 1 FROM email_outbox WHERE to_email = 'v@example.com' AND kind = 'automation'`)).toHaveLength(1)
    // Firing the same trigger for the same subject again does nothing (idempotent).
    await fireTrigger(d, orgId, 'lead.created', leadId, { source: 'station' })
    await runDueJobs(50)
    expect(await listRuns(u.id, orgId)).toHaveLength(1)
    // A manual lead (source manual) does not match the condition.
    await createLead(orgId, { name: 'Manual M', source: 'manual' }, { userId: rep.id })
    await runDueJobs(50)
    expect(await listRuns(u.id, orgId)).toHaveLength(1)

    // Pipeline, notes, tasks, export, isolation.
    await expect(updateLead(rep.id, leadId, { stage: 'Nope' })).rejects.toThrow('pipeline')
    await updateLead(rep.id, leadId, { stage: 'Qualified', tags: ['hot'] })
    await addLeadNote(rep.id, leadId, 'Wants a demo')
    await createTask(rep.id, orgId, { title: 'Send deck', dueOn: '2020-01-01', leadId })
    expect((await pipelineSummary(rep.id, orgId)).stages.find((s) => s.stage === 'Qualified')?.n).toBe(1)
    expect((await listTasks(rep.id, orgId, true)).some((t) => t.overdue)).toBe(true)
    expect(await fireDueTasks(d)).toBeGreaterThanOrEqual(1)
    expect(await fireDueTasks(d)).toBe(0) // reminded once
    const outsider = await makeUser('business', 'Outsider')
    await expect(listLeads(outsider.id, orgId)).rejects.toThrow()
    await expect(updateLead(outsider.id, leadId, { stage: 'Won' })).rejects.toThrow()
    await expect(exportLeadsCsv(rep.id, orgId)).rejects.toThrow() // export needs owner/admin
    expect(await exportLeadsCsv(u.id, orgId)).toContain('Visitor Co')
    await setPipelineStages(u.id, orgId, ['Lead', 'Customer'])
    expect((await pipelineSummary(u.id, orgId)).stages.map((s) => s.stage)).toEqual(['Lead', 'Customer'])
    void autoId
  })
})

describe('email verification and password reset', () => {
  it('verifies with a one-time token, resets with a one-time token and signs out every session; never reveals accounts', async () => {
    const u = await makeUser('free', 'Verify Me')
    const d = await db()
    const mails = async () => d.query<{ text_body: string; kind: string }>(`SELECT text_body, kind FROM email_outbox WHERE to_email = $1 ORDER BY created_at`, [u.email])
    expect((await mails()).some((m) => m.kind === 'verify_email')).toBe(true) // sent at sign-up
    await sendVerificationEmail(u.id)
    const link = (await mails()).filter((m) => m.kind === 'verify_email').at(-1)!.text_body.match(/token=([A-Za-z0-9_-]+)/)![1]
    expect(await verifyEmailToken('nope')).toEqual({ ok: false })
    expect(await verifyEmailToken(link)).toMatchObject({ ok: true })
    expect(await verifyEmailToken(link)).toEqual({ ok: false }) // one-time
    expect((await d.query<{ v: Date | null }>(`SELECT email_verified_at AS v FROM users WHERE id = $1`, [u.id]))[0].v).toBeTruthy()

    await requestPasswordReset('nobody@example.com', { ipKey: 'pr' }) // silent
    await requestPasswordReset(u.email, { ipKey: 'pr' })
    const reset = (await mails()).filter((m) => m.kind === 'reset_password').at(-1)!.text_body.match(/token=([A-Za-z0-9_-]+)/)![1]
    await expect(resetPasswordWithToken(reset, 'short')).rejects.toThrow('10 characters')
    await resetPasswordWithToken(reset, 'a-brand-new-password')
    await expect(resetPasswordWithToken(reset, 'another-new-password')).rejects.toThrow('expired')
    expect((await d.query(`SELECT 1 FROM sessions WHERE user_id = $1 AND revoked_at IS NULL`, [u.id]))).toHaveLength(0)
    await expect(signIn({ email: u.email, password: 'correct horse battery' }, { userAgent: 'vitest', deviceId: null, ipKey: 'pr2' })).rejects.toThrow()
    expect((await signIn({ email: u.email, password: 'a-brand-new-password' }, { userAgent: 'vitest', deviceId: null, ipKey: 'pr2' })).token).toBeTruthy()
    expect((await mails()).some((m) => m.kind === 'security')).toBe(true)
    // Outbox delivery is idempotent and never throws into the caller.
    const [m] = await d.query<{ id: string }>(`SELECT id FROM email_outbox WHERE to_email = $1 LIMIT 1`, [u.email])
    await deliverEmail(d, m.id); await deliverEmail(d, m.id)
  })

  it('usernames are validated, unique and reserved', async () => {
    const a = await makeUser('free', 'User A'), b = await makeUser('free', 'User B')
    await expect(setUsername(a.id, 'ab')).rejects.toThrow('3–30')
    await expect(setUsername(a.id, 'admin')).rejects.toThrow('reserved')
    expect(await setUsername(a.id, 'Carmel-Founder')).toBe('carmel-founder')
    await expect(setUsername(b.id, 'carmel-founder')).rejects.toThrow('taken')
    expect(await setUsername(a.id, '')).toBeNull()
  })
})

describe('global search and AI boundary', () => {
  it('search returns only what the user may see', async () => {
    const { u, orgId } = await organizer()
    await createLead(orgId, { name: 'Zed Searchable', source: 'manual' }, { userId: u.id })
    const other = await makeUser('pro', 'Other Searcher')
    expect((await globalSearch(u.id, 'Zed Sear')).map((h) => h.kind)).toContain('lead')
    expect(await globalSearch(other.id, 'Zed Sear')).toEqual([])
    expect(await globalSearch(u.id, 'Carmel')).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'event' }), expect.objectContaining({ kind: 'workspace' })]))
    expect(await globalSearch(u.id, 'x')).toEqual([])
  })

  it('without a provider or consent, AI tasks fall back to honest templates and say so', async () => {
    const u = await makeUser('pro', 'Fallback Person')
    const r = await runAi(u.id, 'bio', { name: 'Fallback Person', role: 'engineer', company: 'Acme' })
    expect(r.source).toBe('fallback')
    expect(r.text).toContain('Fallback Person is an engineer at Acme')
    expect(r.note).toContain('without AI')
    const d = await db()
    expect(await d.query(`SELECT 1 FROM audit_events WHERE actor_user_id = $1 AND action = 'ai.task'`, [u.id])).toHaveLength(1)
  })
})
