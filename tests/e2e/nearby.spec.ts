import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

const shot = (page: Page, name: string) => page.screenshot({ path: `docs/screenshots/nearby-${name}.png` })
// Two phones standing ~30 m apart in the same hall (fictional test location).
const SPOT_A = { latitude: 32.0853, longitude: 34.7818 }
const SPOT_B = { latitude: 32.0855, longitude: 34.7820 }

async function phone(browser: Browser, geo?: { latitude: number; longitude: number }) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    ...(geo ? { geolocation: geo, permissions: ['geolocation'] } : {}),
  })
  return { ctx, page: await ctx.newPage() }
}

async function signUpWithCard(ctx: BrowserContext, page: Page, name: string, role: string) {
  await page.goto('/signup')
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Email').fill(`${name.split(' ')[0].toLowerCase()}-${Date.now()}@example.com`)
  await page.getByLabel('Password').fill('a-long-test-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/capsules\/new/)
  await page.getByTestId('mode-professional').click()
  await page.getByLabel('One line about you').fill(role)
  await page.getByTestId('field-value-email').fill(`${name.split(' ')[0].toLowerCase()}@work.example`)
  await page.getByTestId('field-value-phone').fill('+1 555 010 4242') // stays "Not shared"
  await page.getByRole('button', { name: 'Create capsule' }).click()
  await expect(page.getByTestId('created-banner')).toBeVisible()
  void ctx
}

async function becomeVisible(page: Page) {
  await page.goto('/share/nearby')
  await page.getByTestId('become-visible').click()
  await page.getByTestId('visibility-everyone').click()
  await expect(page.getByTestId('visibility-button')).toContainText('Visible', { timeout: 15_000 })
}

test('ORYN to ORYN: A sees B, taps Connect, B accepts on Share, both land in People', async ({ browser }) => {
  const a = await phone(browser, SPOT_A)
  const b = await phone(browser, SPOT_B)
  await signUpWithCard(a.ctx, a.page, 'Avery Stone', 'Founder · Stone Labs')
  await signUpWithCard(b.ctx, b.page, 'Blake Rivers', 'Partner · Rivers & Co')

  // Both opt in (it's off by default).
  await becomeVisible(a.page)
  await becomeVisible(b.page)
  // B goes back to Share — their card — and stays discoverable there.
  await b.page.getByTestId('tab-share').click()
  await expect(b.page.getByTestId('wallet-card')).toBeVisible()
  await expect(b.page.getByTestId('nearby-pill')).toContainText('Visible nearby', { timeout: 15_000 })

  // A sees B.
  const row = a.page.getByTestId('nearby-person').filter({ hasText: 'Blake Rivers' })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await expect(row).toContainText('Nearby')
  await shot(a.page, '01-list')

  // The magic moment, timed from A's tap to A seeing "connected".
  const t0 = Date.now()
  await row.getByTestId('nearby-connect').click()
  await expect(b.page.getByTestId('incoming-request')).toBeVisible({ timeout: 10_000 })
  const toB = Date.now() - t0
  await expect(b.page.getByTestId('incoming-request')).toContainText('Avery Stone would like to connect')
  await shot(b.page, '02-incoming')
  await b.page.getByTestId('incoming-accept').click()
  await expect(a.page.getByTestId('connected-toast')).toBeVisible({ timeout: 10_000 })
  const total = Date.now() - t0
  console.log(`[nearby] A tap → B sees request: ${toB} ms · A tap → A sees "connected": ${total} ms (includes B's tap)`)
  await shot(a.page, '03-connected')

  // Both are in People, each with only what the other card allows.
  await a.page.goto('/connections')
  await expect(a.page.getByText('Blake Rivers')).toBeVisible()
  await expect(a.page.getByText(/Exchanged cards/).first()).toBeVisible()
  await b.page.goto('/connections')
  await b.page.getByText('Avery Stone').click()
  await expect(b.page.getByText('avery@work.example')).toBeVisible()
  await expect(b.page.getByText('555 010 4242')).toHaveCount(0)
  // And the request shows as handled, not pending, on Today.
  await b.page.goto('/today')
  await expect(b.page.getByTestId('pending-request').filter({ hasText: 'Avery Stone' })).toHaveCount(0)
  await a.ctx.close(); await b.ctx.close()
})

test('discoverability off really hides you; "Not now" is silent', async ({ browser }) => {
  const a = await phone(browser, SPOT_A)
  const c = await phone(browser, SPOT_B)
  await signUpWithCard(a.ctx, a.page, 'Aria Watch', 'Designer')
  await signUpWithCard(c.ctx, c.page, 'Casey Quiet', 'Engineer')
  await becomeVisible(a.page)
  await becomeVisible(c.page)
  await expect(a.page.getByTestId('nearby-person').filter({ hasText: 'Casey Quiet' })).toBeVisible({ timeout: 15_000 })
  // C turns Nearby off → disappears from A without A doing anything.
  await c.page.getByTestId('visibility-button').click()
  await c.page.getByTestId('visibility-off').click()
  await expect(c.page.getByTestId('nearby-off')).toBeVisible()
  await expect(a.page.getByTestId('nearby-person').filter({ hasText: 'Casey Quiet' })).toHaveCount(0, { timeout: 10_000 })
  // C back on; A asks; C says "Not now"; A still just sees "waiting".
  await c.page.getByTestId('become-visible').click()
  await c.page.getByTestId('visibility-everyone').click()
  const row = a.page.getByTestId('nearby-person').filter({ hasText: 'Casey Quiet' })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await row.getByTestId('nearby-connect').click()
  await expect(c.page.getByTestId('incoming-request')).toBeVisible({ timeout: 10_000 })
  await c.page.getByTestId('incoming-not-now').click()
  await a.page.waitForTimeout(3500)
  await expect(row.getByTestId('nearby-requested')).toBeVisible()
  await expect(a.page.getByTestId('connected-toast')).toHaveCount(0)
  await a.ctx.close(); await c.ctx.close()
})

async function signInDemo(page: Page) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill('demo@oryn.local')
  await page.getByLabel('Password').fill(process.env.E2E_DEMO_PASSWORD ?? 'e2e-only-demo-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/today/)
}

test('location denied → event fallback; demo members are labelled and reply (simulated)', async ({ browser }) => {
  const d = await phone(browser) // no geolocation permission
  await signInDemo(d.page)
  await becomeVisibleNoLocation(d.page)
  await expect(d.page.getByTestId('nearby-location-denied')).toBeVisible({ timeout: 15_000 })
  await d.page.getByRole('button', { name: /Use Harbor Summit 2026 instead/ }).click()
  const daniel = d.page.getByTestId('nearby-person').filter({ hasText: 'Daniel Cohen' })
  await expect(daniel).toBeVisible({ timeout: 15_000 })
  await expect(daniel).toContainText('demo')
  await daniel.getByTestId('nearby-person-open').click()
  await expect(d.page.getByTestId('person-sheet')).toContainText('Demo member')
  await expect(d.page.getByTestId('person-card')).toBeVisible()
  await shot(d.page, '04-person')
  await d.page.getByTestId('person-connect').click()
  await expect(d.page.getByTestId('connected-toast')).toBeVisible({ timeout: 12_000 })
  await d.ctx.close()
})

async function becomeVisibleNoLocation(page: Page) {
  await page.goto('/share/nearby')
  await page.getByTestId('become-visible').click()
  await page.getByTestId('visibility-everyone').click()
}

test('Share is card-first; Present, QR, Wallet and "another way" all work or say why not', async ({ browser }) => {
  const s = await phone(browser)
  await signInDemo(s.page)
  await s.page.getByTestId('tab-share').click()
  await expect(s.page.getByTestId('wallet-card-name')).toHaveText('Noa Adler')
  await expect(s.page.getByTestId('share-qr')).toHaveCount(0)
  expect(await s.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  await shot(s.page, '05-share-card')
  // Tap the card: it turns over to the back designed in Card Studio.
  await s.page.getByTestId('card-flipper').click()
  await expect(s.page.getByTestId('card-flipper')).toHaveAttribute('data-flipped', 'true')
  const url = (await s.page.getByTestId('share-url').textContent())!.trim()

  // Present.
  await s.page.getByTestId('open-present').click()
  await expect(s.page.getByTestId('present-view')).toBeVisible()
  await expect(s.page.getByTestId('present-card-name')).toHaveText('Noa Adler')
  await shot(s.page, '06-present')
  await s.page.getByTestId('present-qr').click()
  await expect(s.page.getByTestId('share-qr')).toBeVisible()
  await shot(s.page, '07-qr')
  await s.page.getByTestId('qr-back').click()

  // Share another way.
  await s.page.getByTestId('share-another-way').click()
  await expect(s.page.getByTestId('share-sheet')).toContainText('Copy ORYN link')
  await expect(s.page.getByTestId('share-sheet-url')).toHaveText(url)
  await s.page.keyboard.press('Escape')

  // Wallet: no keys on this server → both platforms say "Integration pending"; nothing claims success.
  await s.page.getByTestId('open-wallet').click()
  await expect(s.page.getByTestId('wallet-preview')).toContainText('Noa Adler')
  await expect(s.page.getByTestId('wallet-apple-pending')).toContainText('Integration pending')
  await expect(s.page.getByTestId('wallet-google-pending')).toContainText('Integration pending')
  await expect(s.page.getByTestId('wallet-apple-ready')).toHaveCount(0)
  await shot(s.page, '08-wallet')

  // Someone without ORYN: opens the link, sees the card and only what was chosen, can save the contact, is invited.
  const r = await phone(browser)
  await r.page.goto(url)
  await expect(r.page.getByTestId('capsule-name')).toHaveText('Noa Adler')
  await expect(r.page.getByText('555 010 2030')).toHaveCount(0)
  await expect(r.page.getByTestId('oryn-invite')).toBeVisible()
  const [dl] = await Promise.all([r.page.waitForEvent('download'), r.page.getByTestId('save-phone').click()])
  const vcf = await (await dl.createReadStream())!.toArray().then((c) => Buffer.concat(c).toString())
  expect(vcf).toContain('FN:Noa Adler')
  expect(vcf).not.toContain('555 010 2030')
  await s.ctx.close(); await r.ctx.close()
})

test('Card Studio is the source of truth: an edit shows on Share and Present', async ({ browser }) => {
  const s = await phone(browser)
  await signInDemo(s.page)
  await s.page.goto('/capsules/cap_demo_conf')
  await s.page.getByTestId('preset-marble').click()
  await s.page.getByTestId('back-brand').click()
  await s.page.getByRole('button', { name: 'Save changes' }).click()
  await expect(s.page.getByText(/Saved/).first()).toBeVisible()
  await s.page.goto('/share/quick')
  await expect(s.page.getByTestId('wallet-card').locator('[data-material]').first()).toHaveAttribute('data-material', 'marble')
  await expect(s.page.getByTestId('card-back-brand')).toHaveCount(1)
  await s.page.getByTestId('open-present').click()
  await expect(s.page.getByTestId('present-view').locator('[data-material]').first()).toHaveAttribute('data-material', 'marble')
  await s.ctx.close()
})
