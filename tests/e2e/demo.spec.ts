import { test, expect, type Browser, type Page } from '@playwright/test'

const shot = (page: Page, name: string) => page.screenshot({ path: `docs/screenshots/${test.info().project.name}-${name}.png`, fullPage: false })

async function signInDemo(page: Page) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill('demo@oryn.local')
  await page.getByLabel('Password').fill(process.env.E2E_DEMO_PASSWORD ?? 'e2e-only-demo-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/today/)
}

async function recipient(browser: Browser, phone = true) {
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {})
  return { ctx, page: await ctx.newPage() }
}

/** The first founder demo, exactly as specified, in a real browser. */
test('founder demo: create → share → recipient → workspace → revoke', async ({ page, browser }, info) => {
  const email = `e2e-${info.project.name}-${Date.now()}@example.com`

  // Sign up (sender) and land in capsule creation.
  await page.goto('/signup')
  await page.getByLabel('Your name').fill('Maya Stone')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('a-long-test-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/capsules\/new\?first=1/)

  // Test with Pro capabilities (billing is simulated).
  await page.goto('/settings/plan')
  await expect(page.getByTestId('billing-simulated')).toBeVisible()
  await page.getByRole('button', { name: 'Switch to Pro' }).click()
  await expect(page.getByTestId('plan-changed')).toContainText('Pro')

  // 1. Create a capsule.
  await page.goto('/capsules/new')
  await page.getByTestId('mode-professional').click()
  await page.getByLabel('One line about you').fill('Designer · Studio North')
  await page.getByTestId('field-value-role').fill('Designer')
  await page.getByTestId('field-value-company').fill('Studio North')
  await page.getByTestId('field-value-social').fill('linkedin.com/in/maya-example')
  await page.getByTestId('field-value-email').fill('maya@studio.example')
  await page.getByTestId('field-value-website').fill('studio.example')
  await page.getByTestId('field-value-phone').fill('+1 555 010 7777')
  // 2. Select visible fields: email moves to "Learn more", phone stays "Not shared".
  await page.getByTestId('layer-email-expanded').click()
  await expect(page.getByTestId('layer-phone-hidden')).toHaveAttribute('aria-checked', 'true')
  await page.getByLabel('Private note').fill('SECRET: only for Harbor Summit')
  await shot(page, '01-capsule-editor')
  await page.getByRole('button', { name: 'Create capsule' }).click()
  await expect(page.getByTestId('created-banner')).toBeVisible()

  // 3. Activate ORYN: from anywhere, one tap to a live QR. Measure it.
  await page.goto('/today')
  const t0 = Date.now()
  await page.getByTestId(info.project.name === 'phone' ? 'tab-share' : 'rail-share').click()
  await expect(page.getByTestId('share-qr')).toBeVisible()
  const activationMs = Date.now() - t0
  console.log(`[${info.project.name}] tap → live QR: ${activationMs} ms`)
  expect(activationMs).toBeLessThan(3000)
  await shot(page, '02-active-share')
  const url = (await page.getByTestId('share-url').textContent())!.trim()
  const shareUrl = page.url()

  // 4–5. Recipient opens it with no account and sees only the selected fields.
  const r = await recipient(browser, info.project.name === 'phone')
  await r.page.goto(url)
  await expect(r.page.getByTestId('capsule-name')).toHaveText('Maya Stone')
  await expect(r.page.getByTestId('viewing-indicator')).toContainText('Professional capsule')
  await expect(r.page.getByText('Studio North').first()).toBeVisible()
  await expect(r.page.getByText('maya@studio.example')).toHaveCount(0)
  await expect(r.page.getByText('555 010 7777')).toHaveCount(0)
  await expect(r.page.getByText('SECRET')).toHaveCount(0)
  await shot(r.page, '03-recipient-instant')

  // 6. Learn more.
  await r.page.getByTestId('learn-more').click()
  await expect(r.page.getByText('maya@studio.example')).toBeVisible()
  await expect(r.page.getByText('555 010 7777')).toHaveCount(0)
  // 7. ORYN continuation offered only now, in the browser.
  await expect(r.page.getByTestId('app-offer')).toBeVisible()
  await shot(r.page, '04-recipient-expanded')

  // Recipient chooses to connect.
  await r.page.getByRole('link', { name: 'Connect' }).click()
  await r.page.getByLabel('Your name').fill('Sam Rivera')
  await r.page.getByLabel('One way to reach you').fill('sam@rivera.example')
  await r.page.getByLabel('A short note').fill('We met at the coffee line.')
  await r.page.getByRole('button', { name: /Send to Maya/ }).click()
  await expect(r.page.getByTestId('request-sent')).toBeVisible()

  // 8. Sender sees the interaction in the workspace.
  await page.goto('/today')
  await expect(page.getByText('1 opens')).toBeVisible()
  await expect(page.getByTestId('pending-request')).toContainText('Sam Rivera')
  await shot(page, '05-today')
  await page.getByTestId('pending-request').getByRole('button', { name: 'Connect' }).click()
  await expect(page.getByTestId('contact-name')).toHaveText('Sam Rivera')

  // 9. Private note.
  await page.getByTestId('note-body').fill('Wants the onboarding research.')
  await page.getByRole('button', { name: 'Save note' }).click()
  await expect(page.getByTestId('note').filter({ hasText: 'Wants the onboarding research.' })).toBeVisible()
  // 10. Follow-up.
  await page.getByTestId('followup-title').fill('Send Sam the research')
  await page.getByRole('button', { name: 'Set', exact: true }).click()
  await expect(page.getByText('Send Sam the research')).toBeVisible()
  await shot(page, '06-contact')

  // 11. Revoke.
  await page.goto(shareUrl)
  await page.getByTestId('stop-sharing').click()
  await expect(page.getByTestId('share-stopped')).toBeVisible()

  // 12. Recipient can no longer access it — instant, expanded or save.
  await r.page.goto(url)
  await expect(r.page.getByTestId('recipient-unavailable')).toHaveAttribute('data-status', 'revoked')
  await r.page.goto(url + '/more')
  await expect(r.page.getByTestId('recipient-unavailable')).toHaveAttribute('data-status', 'revoked')
  await shot(r.page, '07-recipient-revoked')
  await r.ctx.close()
})

test('seeded demo account: Today, station code, event rules', async ({ page, browser }) => {
  await signInDemo(page)
  await expect(page.getByTestId('pending-request').filter({ hasText: 'Dana Cole' })).toBeVisible()
  await expect(page.getByTestId('demo-banner')).toBeVisible() // fictional data is always labelled

  await page.goto('/stations')
  const link = page.getByTestId('station').first().locator('a[href^="/q/"]')
  const href = await link.getAttribute('href')
  await shot(page, '08-stations')
  const r = await recipient(browser)
  await r.page.goto(href!)
  await expect(r.page.getByTestId('capsule-name')).toHaveText('Noa Adler')
  await expect(r.page.getByTestId('viewing-indicator')).toContainText('Harbor Summit 2026')
  await expect(r.page.getByText('555 010 2030')).toHaveCount(0) // phone hidden + event disallows phones
  await r.ctx.close()
})

test('recipient view works on a slow network and without JavaScript', async ({ browser, page }) => {
  // Create a share via the demo account.
  await signInDemo(page)
  await page.goto('/share/quick')
  const url = (await page.getByTestId('share-url').textContent())!.trim()

  // Slow 3G-like conditions.
  const slow = await recipient(browser)
  const cdp = await slow.ctx.newCDPSession(slow.page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 })
  const t0 = Date.now()
  await slow.page.goto(url, { waitUntil: 'domcontentloaded' })
  await expect(slow.page.getByTestId('capsule-name')).toBeVisible()
  const ms = Date.now() - t0
  console.log(`[slow network] instant view visible in ${ms} ms`)
  expect(ms).toBeLessThan(8000)
  await slow.ctx.close()

  // No JavaScript at all: view, learn more, and send a request still work.
  const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } })
  const p = await nojs.newPage()
  await p.goto(url)
  await expect(p.getByTestId('capsule-name')).toHaveText('Noa Adler')
  await p.getByTestId('learn-more').click()
  await expect(p.getByText('harborlabs.example').first()).toBeVisible()
  await p.getByRole('link', { name: 'Connect' }).click()
  await p.getByLabel('Your name').fill('No Script')
  await p.getByLabel('One way to reach you').fill('noscript@example.com')
  await p.getByRole('button', { name: /Send to Noa/ }).click()
  await expect(p.getByTestId('request-sent')).toBeVisible()
  await nojs.close()
})

test('one-time capsule: link preview does not consume it; second device is refused', async ({ page, browser }) => {
  await signInDemo(page)
  await page.goto('/share?capsule=cap_demo_store')
  await page.getByRole('button', { name: 'Start sharing' }).click()
  const url = (await page.getByTestId('share-url').textContent())!.trim()

  const bot = await browser.newContext({ userAgent: 'Slackbot-LinkExpanding 1.0' })
  const bp = await bot.newPage()
  await bp.goto(url)
  await expect(bp.getByTestId('open-once')).toBeVisible()
  await expect(bp.getByText('instagram.com')).toHaveCount(0)
  await bot.close()

  const first = await recipient(browser)
  await first.page.goto(url)
  await first.page.getByRole('button', { name: 'Open it' }).click()
  await expect(first.page.getByTestId('capsule-name')).toHaveText('Noa')
  await first.page.reload()
  await expect(first.page.getByTestId('capsule-name')).toHaveText('Noa')
  await shot(first.page, '09-recipient-personal')

  const second = await recipient(browser)
  await second.page.goto(url)
  // Already claimed: no "Open it" button is offered at all.
  await expect(second.page.getByRole('button', { name: 'Open it' })).toHaveCount(0)
  await expect(second.page.getByTestId('recipient-unavailable')).toHaveAttribute('data-status', 'claimed')
  await first.ctx.close(); await second.ctx.close()
})

test('workspace pages require sign-in; security headers are set', async ({ page, request }) => {
  for (const path of ['/today', '/capsules', '/connections', '/settings/privacy', '/admin']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/signin/)
  }
  const res = await request.get('/')
  expect(res.headers()['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(res.headers()['x-content-type-options']).toBe('nosniff')
  const api = await request.get('/api/v1/capsules')
  expect(api.status()).toBe(401)
  const csrf = await request.post('/api/v1/shares', { data: {}, headers: { origin: 'https://evil.example' } })
  expect(csrf.status()).toBe(403)
})
