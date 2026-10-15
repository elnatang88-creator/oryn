import { test, expect, type Page } from '@playwright/test'

const shot = (page: Page, name: string) => page.screenshot({ path: `docs/screenshots/platform-${name}.png` })

async function signInDemo(page: Page) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill('demo@oryn.local')
  await page.getByLabel('Password').fill(process.env.E2E_DEMO_PASSWORD ?? 'e2e-only-demo-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/today/)
}

test('events: publish → public page → register (capacity, waitlist) → ticket → check-in once → registrations & CSV', async ({ page, browser }) => {
  await signInDemo(page)
  await page.goto('/events')
  await page.getByRole('link', { name: 'Harbor Summit 2026' }).first().click()
  await expect(page.getByTestId('link-registrations')).toBeVisible()
  await page.locator('#slug').fill('harbor-summit-2026')
  await page.locator('#capacity').fill('1')
  await page.locator('#registrationFields').fill('Dietary needs | select | required | None;Vegan')
  await page.getByTestId('publish-toggle').check()
  await page.getByRole('button', { name: 'Save public page' }).click()
  await expect(page.getByTestId('public-url')).toContainText('/e/harbor-summit-2026')

  // Attendee without an account.
  const a = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage()
  await a.goto('/e/harbor-summit-2026')
  await expect(a.getByTestId('public-event')).toContainText('Harbor Summit 2026')
  await shot(a, '01-public-event')
  await a.getByTestId('register-cta').click()
  await a.getByLabel('Your name').fill('Walk In')
  await a.getByLabel('Email').fill('walkin@example.com')
  await a.locator('#q_dietary_needs').selectOption('Vegan')
  await a.getByRole('button', { name: 'Register' }).click()
  await expect(a.getByTestId('ticket')).toHaveAttribute('data-state', 'valid')
  await expect(a.getByTestId('ticket-qr')).toBeVisible()
  await shot(a, '02-ticket')
  const ticketUrl = a.url()

  // Capacity 1 → the next person is waitlisted.
  const b = await (await browser.newContext()).newPage()
  await b.goto('/register/harbor-summit-2026')
  await expect(b.getByRole('heading', { name: 'Join the waitlist' })).toBeVisible()
  await b.getByLabel('Your name').fill('Second Person')
  await b.getByLabel('Email').fill('second@example.com')
  await b.locator('#q_dietary_needs').selectOption('None')
  await b.getByRole('button', { name: 'Join the waitlist' }).click()
  await expect(b.getByTestId('ticket')).toHaveAttribute('data-state', 'waitlisted')

  // Staff check-in by manual search (camera is not available in CI); second attempt is refused.
  const eventId = (await page.url().match(/events\/(evt_[^/?]+)/))![1]
  await page.goto(`/events/${eventId}/checkin`)
  await page.getByTestId('checkin-search').fill('Walk')
  await page.getByTestId('manual-checkin').click()
  await expect(page.getByTestId('verdict-ok')).toContainText('Welcome, Walk In')
  await shot(page, '03-checkin')
  await expect(page.getByTestId('stat-checked-in')).toHaveText('1')
  // Scanning the same ticket (posted as a scan) → already.
  const res = await page.evaluate(async ({ eventId, ticketUrl }) => { const r = await fetch(`/api/v1/events/${eventId}/checkin`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ref: ticketUrl, method: 'scan' }) }); return (await r.json()).data }, { eventId, ticketUrl })
  expect(res.status).toBe('already')
  await a.reload()
  await expect(a.getByTestId('ticket')).toHaveAttribute('data-state', 'used')

  await page.goto(`/events/${eventId}/registrations`)
  await expect(page.getByTestId('registrations')).toContainText('Walk In')
  const csv = await page.evaluate(async (id) => (await fetch(`/api/v1/events/${id}/registrations?format=csv`)).text(), eventId)
  expect(csv).toContain('walkin@example.com')
  // An anonymous visitor cannot read registrations.
  const anon = await (await browser.newContext()).newPage()
  expect((await anon.request.get(`/api/v1/events/${eventId}/registrations`)).status()).toBe(401)
})

test('stations: lead capture mode → public form with consent → lead in the pipeline → automation ran → CSV', async ({ page, browser }) => {
  await signInDemo(page)
  // Automation first, so the lead triggers it.
  await page.goto('/business/automations')
  await page.getByTestId('auto-name').fill('Booth follow-up')
  await page.getByTestId('auto-trigger').selectOption('lead.created')
  await page.getByTestId('auto-task').fill('Call within 24h')
  await page.getByRole('button', { name: 'Create automation' }).click()
  await expect(page.getByTestId('automations')).toContainText('Booth follow-up')

  await page.goto('/stations')
  await page.getByTestId('station-mode').first().selectOption('lead')
  await page.getByRole('button', { name: 'Update station' }).first().click()
  await expect(page.getByText('Station updated')).toBeVisible()
  const url = (await page.getByTestId('station-url').first().textContent())!.trim()

  const v = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage()
  await v.goto(url)
  await expect(v.getByTestId('station-lead')).toContainText('Harbor Labs')
  await v.getByLabel('Name').fill('Booth Visitor')
  await v.getByLabel('Email').fill('visitor@example.com')
  await v.getByLabel('Company', { exact: false }).fill('Visitor Co')
  await v.getByRole('checkbox').check()
  await shot(v, '04-station-lead')
  await v.getByRole('button', { name: /Send to/ }).click()
  await expect(v.getByText(/has your details/)).toBeVisible()

  await page.goto('/business')
  await expect(page.getByTestId('leads')).toContainText('Booth Visitor')
  await page.getByRole('link', { name: /Booth Visitor/ }).first().click()
  await expect(page.getByTestId('lead-tasks')).toContainText('Call within 24h', { timeout: 10000 })
  await shot(page, '05-lead')
  await page.getByTestId('lead-stage-select').selectOption('Qualified')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved.')).toBeVisible()
  await page.getByTestId('ai-run').click()
  await expect(page.getByTestId('ai-text')).toContainText('Booth Visitor')
  await expect(page.getByTestId('ai-source')).toContainText('without AI')
  await page.goto('/business/automations')
  await expect(page.getByTestId('automation-runs')).toContainText('done')
  // Put the demo station back.
  await page.goto('/stations')
  await page.getByTestId('station-mode').first().selectOption('card')
  await page.getByRole('button', { name: 'Update station' }).first().click()
  await expect(page.getByText('Station updated')).toBeVisible()
})

test('account: verify banner, resend, forgot-password page, ⌘K search, public /u/ address, Command Center', async ({ page, browser }) => {
  // New account → not verified → banner. Resend is rate-limited but works once.
  const email = `platform-${Date.now()}@example.com`
  await page.goto('/signup')
  await page.getByLabel('Your name').fill('Verify Person')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('a-long-test-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByTestId('verify-banner')).toBeVisible()
  await page.goto('/settings/security')
  await expect(page.getByTestId('email-status')).toContainText('not confirmed')
  await page.getByRole('button', { name: 'Send confirmation link' }).click()
  await expect(page.getByText('Sent. Check your inbox.')).toBeVisible()
  await page.goto('/verify?token=not-a-real-token')
  await expect(page.getByTestId('verify-bad')).toBeVisible()
  await page.goto('/forgot')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByText(/reset link is on its way/)).toBeVisible()

  // Public address.
  await page.goto('/settings/notifications')
  await page.getByTestId('username').fill(`verify-${Date.now() % 100000}`)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved.')).toBeVisible()
  const uname = await page.getByTestId('username').inputValue()
  const anon = await (await browser.newContext()).newPage()
  await anon.goto(`/u/${uname}`)
  await expect(anon.getByTestId('recipient-unavailable')).toHaveAttribute('data-status', 'not_found') // no card yet
  await page.goto('/capsules/new')
  await page.getByTestId('mode-professional').click()
  await page.getByRole('button', { name: 'Create capsule' }).click()
  await anon.goto(`/u/${uname}`)
  await expect(anon.getByTestId('capsule-name')).toHaveText('Verify Person')

  // ⌘K.
  await page.goto('/today')
  await page.keyboard.press('Control+k')
  await page.getByTestId('search-input').fill('Verify')
  await expect(page.getByTestId('search-results')).toContainText('Professional')

  // Command Center is admin-only.
  expect((await page.request.get('/admin/users')).status()).toBe(404)
  const admin = await (await browser.newContext()).newPage()
  await admin.goto('/signin')
  await admin.getByLabel('Email').fill('admin@oryn.local')
  await admin.getByLabel('Password').fill(process.env.E2E_DEMO_PASSWORD ?? 'e2e-only-demo-password')
  await admin.getByRole('button', { name: 'Sign in' }).click()
  await expect(admin).toHaveURL(/\/(today|capsules)/)
  await admin.goto('/admin/health')
  await expect(admin.getByTestId('platform-config')).toContainText('integration pending')
  await admin.goto('/admin/users?q=Verify')
  await expect(admin.getByTestId('admin-table')).toContainText(email)
})
