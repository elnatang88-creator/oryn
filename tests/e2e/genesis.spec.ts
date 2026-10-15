import { test, expect, type Page } from '@playwright/test'

/**
 * Genesis V2 walkthrough: every required screen, desktop and phone (project name is the suffix), with
 * screenshots in docs/screenshots/genesis-<project>-NN-<name>.png. Assertions are on real behaviour, not looks.
 */
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/screenshots/genesis-${test.info().project.name.replace('genesis-', '')}-${name}.png` })
const PASSWORD = process.env.E2E_DEMO_PASSWORD ?? 'e2e-only-demo-password'

async function signIn(page: Page, email: string) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/(today|capsules)/)
}

test('login → onboarding (5 steps with progress) → dashboard → card → editor → wallet center → notifications', async ({ page, browser }, info) => {
  // Login screen: in a production build there is no demo-credential hint on the page.
  await page.goto('/signin')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(page.getByTestId('demo-credentials')).toHaveCount(0)
  await page.waitForTimeout(1600) // the entry stage deals the cards in (~1.1 s); screenshot the settled screen
  await shot(page, '01-login')

  // Onboarding: step 1 identity → step 2 profile type → step 3 card → (4 appearance is inside the editor) → 5 share.
  await page.goto('/signup')
  await expect(page.getByTestId('onboarding-progress')).toHaveAttribute('data-step', '1')
  await page.waitForTimeout(1600)
  await shot(page, '02-onboarding-1')
  const email = `genesis-${info.project.name}-${Date.now()}@example.com`
  await page.getByLabel('Your name').fill('Genesis Person')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('a-long-test-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/capsules\/new\?first=1/)
  await expect(page.getByTestId('onboarding-progress')).toHaveAttribute('data-step', '2')
  await shot(page, '03-onboarding-2')
  await page.getByTestId('mode-professional').click()
  await expect(page.getByTestId('onboarding-progress')).toHaveAttribute('data-step', '3')
  await page.getByLabel('One line about you').fill('Founder · Genesis Labs')
  await shot(page, '04-editor')
  await page.getByRole('button', { name: 'Create capsule' }).click()
  await expect(page.getByTestId('first-run')).toBeVisible()
  await expect(page.getByTestId('onboarding-progress')).toHaveAttribute('data-step', '5')
  await shot(page, '05-onboarding-5-share')
  // The flagship: a new card is Obsidian Black, engraved, with the reveal settled.
  await expect(page.getByTestId('wallet-card').locator('[data-material]').first()).toHaveAttribute('data-material', 'obsidian')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(1300)
  await shot(page, '05b-obsidian-black')

  // Dashboard: the primary card block with quick share; no workspace blocks for an individual.
  await page.goto('/today')
  await expect(page.getByTestId('primary-card')).toContainText('Genesis Person')
  await expect(page.getByTestId('workspace-pulse')).toHaveCount(0)
  await expect(page.getByTestId('notification-bell').first()).toHaveAttribute('data-unread', '0')
  await shot(page, '06-dashboard')

  // Card lifecycle: duplicate → copy opens for editing; make it active from the list.
  await page.goto('/settings/plan')
  await page.getByRole('button', { name: 'Switch to Pro' }).click()
  await expect(page.getByTestId('plan-changed')).toContainText('Pro')
  await page.goto('/capsules')
  await page.getByTestId('duplicate-card').first().click()
  await expect(page.getByTestId('duplicated-banner')).toBeVisible()
  await expect(page.getByTestId('collections')).toBeVisible()
  await page.getByTestId('preset-gold').click()
  await shot(page, '04b-studio-collections')
  // Logo upload: resized on the device into the design, persisted, shown on the card.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAQklEQVR42u3OMQEAAAgDoGn/zjOGDxBJOkk5cuTIkSNHjhw5cuTIkSNHjhw5cuTIkSNHjhw5cuTIkSNHjhw5cuTI0bsBTnkA/ZQ3Qe0AAAAASUVORK5CYII=', 'base64')
  await page.getByTestId('logo-file').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByTestId('logo-preview')).toBeVisible()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText(/Saved/).first()).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('logo-preview')).toBeVisible()
  await expect(page.getByTestId('card-logo').first()).toBeVisible()
  await page.goto('/capsules')
  await expect(page.getByTestId('capsule-card')).toHaveCount(2)
  await page.getByTestId('set-active').first().click()
  await expect(page.getByTestId('active-card')).toHaveCount(1)

  // Card (owner view) — the card object itself; the public card (no account) carries the same design and logo.
  await page.getByTestId(info.project.name.endsWith('mobile') ? 'tab-share' : 'rail-share').click()
  await expect(page.getByTestId('wallet-card-name')).toHaveText('Genesis Person')
  await expect(page.getByTestId('wallet-card').locator('[data-material]').first()).toHaveAttribute('data-material', 'gold')
  await expect(page.getByTestId('wallet-card').getByTestId('card-logo').first()).toBeVisible()
  await page.waitForTimeout(1300) // reveal animation
  await shot(page, '07-card')
  const publicUrl = (await page.getByTestId('share-url').textContent())!.trim()
  const anon = await (await browser.newContext(info.project.name.endsWith('mobile') ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {})).newPage()
  await anon.goto(publicUrl)
  await expect(anon.getByTestId('capsule-name')).toHaveText('Genesis Person')
  await expect(anon.locator('[data-material]').first()).toHaveAttribute('data-material', 'gold')
  await expect(anon.getByTestId('card-logo').first()).toBeVisible()
  await shot(anon, '07b-public-card')
  await anon.close()

  // Wallet Center: no keys on this server → both pending, nothing claims success; the unsigned preview is labelled.
  await page.goto('/wallet')
  await expect(page.getByTestId('wallet-card')).toBeVisible()
  await expect(page.getByTestId('wallet-apple-pending')).toContainText('Integration pending')
  await expect(page.getByTestId('wallet-google-pending')).toContainText('Integration pending')
  await expect(page.getByTestId('wallet-apple-ready')).toHaveCount(0)
  await expect(page.getByTestId('wallet-no-pass')).toBeVisible()
  await shot(page, '08-wallet-center')
  const previewForm = page.getByTestId('wallet-apple-preview')
  if (await previewForm.count()) {
    const [dl] = await Promise.all([page.waitForEvent('download'), previewForm.getByRole('button').click()])
    expect(dl.suggestedFilename()).toMatch(/\.preview\.pkpass\.zip$/)
    await page.goto('/wallet')
    await expect(page.getByTestId('wallet-pass-link')).toContainText('Live')
  }

  // Live stream: authenticated SSE answers with the hello event and an initial notifications count.
  const sse = await page.evaluate(async () => {
    const ctrl = new AbortController()
    const r = await fetch('/api/v1/stream?topics=notifications', { signal: ctrl.signal })
    const reader = r.body!.getReader(); const dec = new TextDecoder(); let text = ''
    const t0 = Date.now()
    while (!text.includes('event: notifications') && Date.now() - t0 < 8000) { const { value, done } = await reader.read(); if (done) break; text += dec.decode(value) }
    ctrl.abort()
    return { type: r.headers.get('content-type'), text }
  })
  expect(sse.type).toContain('text/event-stream')
  expect(sse.text).toContain('event: hello')
  expect(sse.text).toContain('event: notifications')

  // Notification center.
  await page.goto('/notifications')
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  await shot(page, '09-notifications')
})

test('workspace member: dashboard pulse → station → registration → ticket states → check-in → business → command center', async ({ page, browser }) => {
  await signIn(page, 'demo@oryn.local')
  await expect(page.getByTestId('workspace-pulse').first()).toBeVisible()
  await shot(page, '10-dashboard-business')

  // Station (configure + public resolve).
  await page.goto('/stations')
  await expect(page.getByTestId('station').first()).toBeVisible()
  await shot(page, '11-station')

  // Registration: publish an event, register a guest.
  await page.goto('/events')
  await page.getByRole('link', { name: 'Harbor Summit 2026' }).first().click()
  await expect(page).toHaveURL(/events\/evt_/)
  const eventId = page.url().match(/events\/(evt_[^/?]+)/)![1]
  await page.locator('#slug').fill('genesis-summit')
  // Projects share one server: put the event in the future again (the expiry step below moves it to the past).
  const y = new Date().getFullYear() + 1
  // platform.spec edits this same demo event (capacity 1, a required extra question); reset both so plain registration works.
  await page.locator('#capacity').fill('')
  await page.locator('#registrationFields').fill('')
  await page.locator('#startsAt').fill(`${y}-06-01T09:00`)
  await page.locator('#endsAt').fill(`${y}-06-01T17:00`)
  await page.getByTestId('publish-toggle').check()
  await page.getByRole('button', { name: 'Save public page' }).click()
  await expect(page.getByTestId('public-url')).toContainText('/e/genesis-summit')
  const guest = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage()
  await guest.goto('/register/genesis-summit')
  await shot(guest, '12-registration')
  await guest.getByLabel('Your name').fill('Genesis Guest')
  await guest.getByLabel('Email').fill(`guest-${Date.now()}@example.com`)
  await guest.getByRole('button', { name: 'Register' }).click()
  await expect(guest.getByTestId('ticket')).toHaveAttribute('data-state', 'valid')
  await expect(guest.getByTestId('ticket-state')).toHaveText('Valid')
  await shot(guest, '13-ticket-valid')
  const ticketUrl = guest.url()

  // Check-in (manual search in CI) → ticket shows "Checked in"; a second scan is refused.
  await page.goto(`/events/${eventId}/checkin`)
  await page.getByTestId('checkin-search').fill('Genesis Guest')
  await page.getByTestId('manual-checkin').click()
  await expect(page.getByTestId('verdict-ok')).toContainText('Welcome, Genesis Guest')
  await shot(page, '14-checkin')
  await guest.reload()
  await expect(guest.getByTestId('ticket')).toHaveAttribute('data-state', 'used')
  await expect(guest.getByTestId('ticket-state')).toHaveText('Checked in')
  await shot(guest, '15-ticket-checked-in')
  const again = await page.evaluate(async ({ eventId, ticketUrl }) => { const r = await fetch(`/api/v1/events/${eventId}/checkin`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ref: ticketUrl, method: 'scan' }) }); return (await r.json()).data }, { eventId, ticketUrl })
  expect(again.status).toBe('already')

  // Cancelled state (a second registration), then Expired (end the event in the past).
  const second = await (await browser.newContext()).newPage()
  await second.goto('/register/genesis-summit')
  await second.getByLabel('Your name').fill('Cancel Person')
  await second.getByLabel('Email').fill(`cancel-${Date.now()}@example.com`)
  await second.getByRole('button', { name: 'Register' }).click()
  await expect(second.getByTestId('ticket')).toHaveAttribute('data-state', 'valid')
  const third = await (await browser.newContext()).newPage()
  await third.goto('/register/genesis-summit')
  await third.getByLabel('Your name').fill('Expire Person')
  await third.getByLabel('Email').fill(`expire-${Date.now()}@example.com`)
  await third.getByRole('button', { name: 'Register' }).click()
  await expect(third.getByTestId('ticket')).toHaveAttribute('data-state', 'valid')
  await second.getByTestId('ticket-cancel').click()
  await expect(second.getByTestId('ticket')).toHaveAttribute('data-state', 'cancelled')
  await expect(second.getByTestId('ticket-state')).toHaveText('Cancelled')
  await page.goto(`/events/${eventId}`)
  await page.locator('#startsAt').fill('2020-01-01T09:00')
  await page.locator('#endsAt').fill('2020-01-01T17:00')
  await page.getByRole('button', { name: 'Save public page' }).click()
  await third.reload()
  await expect(third.getByTestId('ticket')).toHaveAttribute('data-state', 'expired')
  await expect(third.getByTestId('ticket-state')).toHaveText('Expired')
  await shot(third, '16-ticket-expired')

  // Business UI.
  await page.goto('/business')
  await expect(page.getByTestId('pipeline')).toBeVisible()
  await shot(page, '17-business')

  // Command Center (platform admin only; demo user gets 404).
  expect((await page.request.get('/admin/health')).status()).toBe(404)
  const admin = await (await browser.newContext({ viewport: page.viewportSize() ?? undefined })).newPage()
  await signIn(admin, 'admin@oryn.local')
  await admin.goto('/admin/health')
  await expect(admin.getByTestId('platform-config')).toBeVisible()
  await shot(admin, '18-command-center')
})
