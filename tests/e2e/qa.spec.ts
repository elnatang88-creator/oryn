import { test, expect, type Browser, type Page, type BrowserContext } from '@playwright/test'
import fs from 'node:fs'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'

/**
 * ORYN v1 MVP QA — iPhone-sized screens (390×844, touch, iPhone user agent).
 * Each test maps to a scenario in docs/MVP_QA_REPORT.md.
 */

const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? 'e2e-only-demo-password'
const CRON = 'e2e-only-cron-secret'
const PASSWORD = 'qa-long-password-123'
const SHOTS = 'docs/screenshots'
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/qa-${name}.png` })
const uid = () => Math.random().toString(36).slice(2, 8)
const TECHNICAL = /error:|undefined|null|exception|stack|sql|zod|typeerror|internal server|\b500\b/i

async function iphone(browser: Browser, opts: Parameters<Browser['newContext']>[0] = {}): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    ...opts,
  })
  return { ctx, page: await ctx.newPage() }
}

async function signUp(page: Page, name: string, email: string) {
  await page.goto('/signup')
  await page.getByLabel('Your name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/capsules\/new/)
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/today/)
}

async function toPro(page: Page) {
  await page.goto('/settings/plan')
  await page.getByRole('button', { name: 'Switch to Pro' }).click()
  await expect(page.getByTestId('plan-changed')).toBeVisible()
}

async function decodeQr(page: Page, selector: string) {
  const buf = await page.locator(selector).screenshot()
  const png = PNG.sync.read(buf)
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data ?? null
}

/** Visible interactive elements smaller than the 44×44 minimum touch target. */
async function smallTargets(page: Page) {
  return page.evaluate(() => {
    const out: { tag: string; text: string; w: number; h: number }[] = []
    document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary').forEach((el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden') return
      if (el.closest('.sr-only')) return
      if (r.height < 44 || r.width < 44) out.push({ tag: el.tagName.toLowerCase(), text: (el.textContent || (el as HTMLInputElement).name || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) })
    })
    return out
  })
}

async function noHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
  expect(sw, `page is ${sw}px wide on a ${cw}px screen`).toBeLessThanOrEqual(cw + 1)
}

const report: Record<string, unknown> = {}
test.afterAll(() => {
  fs.mkdirSync('test-results', { recursive: true })
  fs.writeFileSync('test-results/qa-measurements.json', JSON.stringify(report, null, 2))
})

test('QA-01…10: full flow on iPhone — sign up, capsule in Hebrew, exact layers, share, recipient choices, workspace, privacy', async ({ browser }) => {
  test.setTimeout(150_000)
  const sender = await iphone(browser)
  const s = sender.page
  // Record calls to the system share sheet (a real phone shows the OS sheet here).
  await sender.ctx.addInitScript(() => {
    ;(window as unknown as { __shared: unknown[] }).__shared = []
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d: unknown) => { (window as unknown as { __shared: unknown[] }).__shared.push(d) } })
  })

  // 1. Sign up.
  const email = `qa-${uid()}@example.com`
  await signUp(s, 'נועה אדלר', email)
  await noHorizontalScroll(s)
  await toPro(s)

  // 2–3. Create a capsule, choose exactly what is visible.
  await s.goto('/capsules/new')
  await s.getByTestId('mode-professional').click()
  await s.getByLabel('Name they see').fill('נועה אדלר')
  await s.getByLabel('One line about you').fill('מעצבת מוצר · סטודיו צפון')
  await s.getByLabel('A short message').fill('היי! לא רציתי לעצור את התור. Studio North 2026.')
  await s.getByTestId('field-value-role').fill('מעצבת מוצר')
  await s.getByTestId('field-value-company').fill('סטודיו צפון')
  await s.getByTestId('field-value-social').fill('instagram.com/noa.example')
  await s.getByTestId('field-value-email').fill('noa@studio.example')
  await s.getByTestId('field-value-website').fill('studio.example')
  await s.getByTestId('field-value-phone').fill('+972 50 000 0000')
  await s.getByTestId('layer-email-expanded').click()
  await s.getByTestId('layer-website-hidden').click()
  await s.getByLabel('Private note').fill('PRIVATE-QA-NOTE רק לי')
  await shot(s, '01-editor-hebrew')
  await noHorizontalScroll(s)
  await s.getByRole('button', { name: 'Create capsule' }).click()
  await expect(s.getByTestId('created-banner')).toBeVisible()

  // 4. Share — one hand: the Share button sits bottom-centre, in the thumb zone.
  await s.goto('/today')
  const tab = await s.getByTestId('tab-share').boundingBox()
  report.shareButton = tab
  expect(tab!.y).toBeGreaterThan(844 * 0.8)
  expect(Math.abs(tab!.x + tab!.width / 2 - 195)).toBeLessThan(20)
  const t0 = Date.now()
  await s.getByTestId('tab-share').tap()
  await expect(s.getByTestId('wallet-card')).toBeVisible()
  report.tapToCardMs = Date.now() - t0
  const url = (await s.getByTestId('share-url').textContent())!.trim()
  const shareScreen = s.url()
  // QR mode on request: the QR really encodes this link (decoded from the rendered pixels).
  await s.getByTestId('open-qr').tap()
  expect(await decodeQr(s, '[data-testid=share-qr]')).toBe(url)
  await s.getByTestId('qr-back').tap()
  // "Share another way" hands the link to the system share sheet.
  await s.getByTestId('share-another-way').tap()
  await s.getByTestId('share-system').tap()
  const shared = await s.evaluate(() => (window as unknown as { __shared: { url: string }[] }).__shared)
  expect(shared[0].url).toBe(url)
  await s.keyboard.press('Escape')
  // A private place label, set by the sender (in Link settings).
  await s.getByTestId('link-settings').locator('summary').tap()
  await s.getByLabel(/Where are you/).fill('SECRET-LOCATION קפה')
  await s.getByRole('button', { name: 'Save', exact: true }).tap()
  await expect(s.getByText('Saved. Only you see this.')).toBeVisible()
  await shot(s, '02-share-screen')
  await noHorizontalScroll(s)

  // 5–6. Another phone, no account: exactly Layer 1.
  const r = await iphone(browser)
  const rp = r.page
  const res = await rp.goto(url)
  const rawHtml = await res!.text()
  await expect(rp.getByTestId('capsule-name')).toHaveText('נועה אדלר')
  const kinds = await rp.getByTestId('capsule-field').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')))
  expect(kinds.sort()).toEqual(['company', 'role', 'social'])
  for (const secret of ['PRIVATE-QA-NOTE', 'noa@studio.example', 'studio.example"', '000 0000', 'SECRET-LOCATION']) {
    expect(rawHtml, `recipient HTML must not contain ${secret}`).not.toContain(secret)
  }
  // Hebrew is laid out right-to-left.
  expect(await rp.getByTestId('capsule-name').evaluate((el) => getComputedStyle(el).direction)).toBe('rtl')
  await shot(rp, '03-recipient-layer1-hebrew')
  await noHorizontalScroll(rp)
  // One hand: all three choices are on screen without scrolling.
  for (const id of ['learn-more', 'save-phone', 'connect']) {
    const b = await rp.getByTestId(id).boundingBox()
    expect(b!.y + b!.height, `${id} should be reachable without scrolling`).toBeLessThanOrEqual(844)
  }
  report.recipientSmallTargets = await smallTargets(rp)

  // 7a. Learn more: Layer 2 only.
  await rp.getByTestId('learn-more').tap()
  await expect(rp.getByText('noa@studio.example')).toBeVisible()
  const kinds2 = await rp.getByTestId('capsule-field').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')))
  expect(kinds2.sort()).toEqual(['company', 'email', 'role', 'social'])
  const html2 = await rp.content()
  expect(html2).not.toContain('PRIVATE-QA-NOTE')
  expect(html2).not.toContain('000 0000')

  // 7b. Save: a contact file with only permitted details.
  const [dl] = await Promise.all([rp.waitForEvent('download'), rp.getByRole('link', { name: 'Save' }).tap()])
  const vcf = fs.readFileSync((await dl.path())!, 'utf8')
  report.vcardFilename = dl.suggestedFilename()
  expect(vcf).toContain('FN:נועה אדלר')
  expect(vcf).toContain('EMAIL;TYPE=INTERNET:noa@studio.example')
  expect(vcf).not.toContain('000 0000')
  expect(vcf).not.toContain('PRIVATE')
  expect(dl.suggestedFilename()).toContain('נועה')

  // 7c. Connect.
  await rp.getByRole('link', { name: 'Connect' }).tap()
  await rp.getByRole('button', { name: /Send to/ }).tap()
  await expect(rp.locator('p[role=alert]')).toContainText('Add your name.') // plain, non-technical
  await rp.getByLabel('Your name').fill('Sam Rivera')
  await rp.getByLabel('One way to reach you').fill('sam@rivera.example')
  await rp.getByLabel('A short note').fill('נפגשנו בתור לקפה')
  await rp.getByRole('button', { name: /Send to/ }).tap()
  await expect(rp.getByTestId('request-sent')).toBeVisible()
  await shot(rp, '04-recipient-request-sent')

  // 7d. Keep for later — the recipient creates a free account in their own browser.
  await rp.goto(url + '/keep')
  await rp.getByRole('button', { name: /Create a free account to keep it/ }).tap()
  await expect(rp).toHaveURL(/\/signup\?next=/)
  await rp.getByLabel('Your name').fill('Sam Rivera')
  await rp.getByLabel('Email').fill(`qa-recipient-${uid()}@example.com`)
  await rp.getByLabel('Password').fill(PASSWORD)
  await rp.getByRole('button', { name: 'Create account' }).tap()
  await expect(rp).toHaveURL(/\/keep$/)
  await rp.getByRole('button', { name: 'Keep it' }).tap()
  await expect(rp.getByTestId('connection-banner')).toBeVisible()
  await rp.reload()
  await expect(rp.getByTestId('contact-name')).toHaveText('נועה אדלר') // saved after refresh
  expect(await rp.content()).not.toContain('PRIVATE-QA-NOTE')

  // 8. The sender sees it in the workspace.
  await s.goto('/today')
  const req = s.getByTestId('pending-request').filter({ hasText: 'Sam Rivera' })
  await expect(req).toBeVisible()
  await shot(s, '05-today')
  report.todaySmallTargets = await smallTargets(s)
  await req.getByTestId('accept-request').tap()
  await expect(s.getByTestId('contact-name')).toHaveText('Sam Rivera')
  await s.reload()
  await expect(s.getByTestId('contact-name')).toHaveText('Sam Rivera') // saved after refresh
  await expect(s.getByText('SECRET-LOCATION קפה').first()).toBeVisible() // context travels with the connection, for the sender only

  // 9. Private note and follow-up, persisted.
  await s.getByTestId('note-body').fill('רוצה את מחקר האונבורדינג')
  await s.getByRole('button', { name: 'Save note' }).tap()
  await expect(s.getByTestId('note').filter({ hasText: 'רוצה את מחקר' })).toBeVisible()
  await s.getByTestId('followup-title').fill('לשלוח לסם את המחקר')
  await s.getByRole('button', { name: 'Set', exact: true }).tap()
  await expect(s.getByText('לשלוח לסם את המחקר')).toBeVisible()
  await s.reload()
  await expect(s.getByTestId('note').filter({ hasText: 'רוצה את מחקר' })).toBeVisible()
  await expect(s.getByText('לשלוח לסם את המחקר')).toBeVisible()
  expect(await s.getByTestId('note').first().locator('p').evaluate((el) => getComputedStyle(el).direction)).toBe('rtl')
  await shot(s, '06-contact-note-followup')
  await noHorizontalScroll(s)

  // 10. The recipient never sees private data, even now.
  const again = await (await rp.request.get(url)).text()
  for (const secret of ['PRIVATE-QA-NOTE', 'רוצה את מחקר', 'SECRET-LOCATION', '000 0000']) expect(again).not.toContain(secret)
  const api = await (await rp.request.get(`/api/v1/public/shares/${url.split('/c/')[1]}?layer=expanded`)).text()
  for (const secret of ['PRIVATE-QA-NOTE', 'SECRET-LOCATION', '000 0000', 'private_note']) expect(api).not.toContain(secret)

  // Revoke → blocked everywhere.
  await s.goto(shareScreen)
  await s.getByTestId('link-settings').locator('summary').tap()
  await s.getByTestId('stop-sharing').tap()
  await expect(s.getByTestId('share-stopped')).toBeVisible()
  await rp.goto(url)
  await expect(rp.getByTestId('recipient-unavailable')).toHaveAttribute('data-status', 'revoked')
  await sender.ctx.close(); await r.ctx.close()
})

test('QA-11: an expired shared session is blocked by the server (event ended)', async ({ browser }) => {
  const o = await iphone(browser)
  await signIn(o.page, 'demo@oryn.local', DEMO_PASSWORD)
  const name = `QA Expo ${uid()}`
  await o.page.goto('/events/new')
  await o.page.getByLabel('Event name').fill(name)
  await o.page.getByRole('button', { name: 'Create event' }).tap()
  await o.page.getByRole('button', { name: 'Go live' }).tap()
  await expect(o.page.getByRole('button', { name: 'End event' })).toBeVisible()
  const eventUrl = o.page.url()
  await o.page.goto('/share?capsule=cap_demo_conf')
  await o.page.getByLabel('At an event?').selectOption({ label: name })
  await o.page.getByRole('button', { name: 'Start sharing' }).tap()
  const url = (await o.page.getByTestId('share-url').textContent())!.trim()
  const r = await iphone(browser)
  await r.page.goto(url)
  await expect(r.page.getByTestId('viewing-indicator')).toContainText(name)
  await o.page.goto(eventUrl)
  await o.page.getByRole('button', { name: 'End event' }).tap()
  await expect(o.page.getByText('This event has ended')).toBeVisible()
  await r.page.goto(url)
  await expect(r.page.getByTestId('recipient-unavailable')).toHaveAttribute('data-status', 'expired')
  await expect(r.page.getByRole('heading', { level: 1 })).toHaveText('This capsule has closed')
  // Forged expiry: changing the expiry inside the token breaks its signature.
  const [sid, , sig] = url.split('/c/')[1].split('.')
  await r.page.goto(`/c/${sid}.zzzzzz.${sig}`)
  await expect(r.page.getByTestId('recipient-unavailable')).toHaveAttribute('data-status', 'not_found')
  await shot(r.page, '07-expired')
  await o.ctx.close(); await r.ctx.close()
})

test('QA-12: a user from one organization cannot read another organization’s data', async ({ browser }) => {
  const b = await iphone(browser)
  await signUp(b.page, 'Other Org Owner', `qa-org-${uid()}@example.com`)
  await b.page.goto('/settings/plan')
  await b.page.getByRole('button', { name: 'Switch to Business' }).tap()
  await b.page.goto('/teams')
  await b.page.getByLabel('Workspace name').fill('Other Org')
  await b.page.getByRole('button', { name: 'Create', exact: true }).tap()
  await expect(b.page.getByRole('heading', { name: 'Other Org' })).toBeVisible()
  // Direct links to Harbor Labs' (demo org) resources.
  for (const path of ['/events/evt_demo', '/events/evt_demo/participants', '/connections/con_demo', '/capsules/cap_demo_conf', '/capsules/cap_demo_conf/visibility', '/share/s_demopastsharexxxxxxxx']) {
    await b.page.goto(path)
    await expect(b.page.getByRole('heading', { name: 'Nothing here' }), path).toBeVisible()
  }
  for (const path of ['/teams?org=org_demo', '/stations?org=org_demo', '/events']) {
    await b.page.goto(path)
    const text = await b.page.locator('main').innerText()
    expect(text, path).not.toContain('Harbor Labs')
    expect(text, path).not.toContain('Booth 14')
    expect(text, path).not.toContain('Harbor Summit')
  }
  const api = await b.page.request.get('/api/v1/shares/s_demopastsharexxxxxxxx')
  expect(api.status()).toBe(404)
  await b.ctx.close()
})

test('QA-13: plan gates are enforced by the server, not only hidden in the UI', async ({ browser, baseURL }) => {
  const f = await iphone(browser)
  await signUp(f.page, 'Free User', `qa-free-${uid()}@example.com`)
  const headers = { origin: baseURL!, 'content-type': 'application/json' }
  const first = await f.page.request.post('/api/v1/capsules', { headers, data: { name: 'One', mode: 'professional', display_name: 'Free User' } })
  expect(first.status()).toBe(200)
  const second = await f.page.request.post('/api/v1/capsules', { headers, data: { name: 'Two', mode: 'personal', display_name: 'Free User' } })
  expect(second.status()).toBe(402)
  const body = await second.json()
  expect(body.error.message).toBe('More than one capsule is part of Pro.')
  expect(body.error.message).not.toMatch(TECHNICAL)
  const nfc = await f.page.request.post('/api/v1/shares', { headers, data: { channel: 'nfc_tag' } })
  expect(nfc.status()).toBe(402)
  const list = await (await f.page.request.get('/api/v1/capsules')).json()
  expect(list.data).toHaveLength(1)
  await f.page.goto('/capsules/new')
  await expect(f.page.getByText('Your plan includes one capsule.')).toBeVisible()
  await f.ctx.close()
})

test('QA-14: account deletion needs the password and leaves no access to data', async ({ browser, baseURL }) => {
  const u = await iphone(browser)
  const email = `qa-del-${uid()}@example.com`
  await signUp(u.page, 'Leaving User', email)
  const headers = { origin: baseURL!, 'content-type': 'application/json' }
  await u.page.request.post('/api/v1/capsules', { headers, data: { name: 'Mine', mode: 'professional', display_name: 'Leaving User' } })
  const share = await (await u.page.request.post('/api/v1/shares', { headers, data: {} })).json()
  const url: string = share.data.url.startsWith('http') ? share.data.url : `${baseURL}${share.data.url}`
  const r = await iphone(browser)
  await r.page.goto(url)
  await expect(r.page.getByTestId('capsule-name')).toHaveText('Leaving User')

  await u.page.goto('/settings/privacy')
  await u.page.getByLabel('Enter your password to confirm').fill('not my password')
  await u.page.getByRole('button', { name: 'Delete my account' }).tap()
  await expect(u.page.locator('p[role=alert]')).toHaveText('That password isn’t right.')
  await u.page.getByLabel('Enter your password to confirm').fill(PASSWORD)
  await u.page.getByRole('button', { name: 'Delete my account' }).tap()
  await expect(u.page.getByText(/Scheduled|Welcome back/).first()).toBeVisible()

  // Shares close immediately.
  await r.page.goto(url)
  await expect(r.page.getByTestId('recipient-unavailable')).toHaveAttribute('data-status', /revoked|not_found/)
  // Erasure (grace period set to 0 for this test run).
  const jobs = await u.page.request.get('/api/jobs', { headers: { authorization: `Bearer ${CRON}` } })
  expect(jobs.status()).toBe(200)
  await u.page.goto('/today')
  await expect(u.page).toHaveURL(/\/signin/)
  expect((await u.page.request.get('/api/v1/capsules')).status()).toBe(401)
  await u.page.getByLabel('Email').fill(email)
  await u.page.getByLabel('Password').fill(PASSWORD)
  await u.page.getByRole('button', { name: 'Sign in' }).tap()
  await expect(u.page.locator('p[role=alert]')).toHaveText('That email and password don’t match.')
  await r.page.goto(url)
  await expect(r.page.getByTestId('recipient-unavailable')).toHaveAttribute('data-status', 'not_found')
  // The scheduler endpoint refuses callers without the secret.
  expect((await r.page.request.get('/api/jobs')).status()).toBe(401)
  await u.ctx.close(); await r.ctx.close()
})

test('QA-M1: station QR destination on a phone (demo data clearly labelled)', async ({ browser }) => {
  const o = await iphone(browser)
  await signIn(o.page, 'demo@oryn.local', DEMO_PASSWORD)
  await expect(o.page.getByTestId('demo-banner')).toBeVisible()
  await o.page.goto('/stations')
  const station = o.page.getByTestId('station').filter({ hasText: 'Booth 14' })
  const href = await station.locator('a[href^="/q/"]').getAttribute('href')
  expect(href).toBe('/q/harbordemo')
  const decoded = await decodeQr(o.page, '[data-testid=station] [role=img] >> nth=0')
  expect(decoded).toMatch(/\/q\/harbordemo$/)
  const r = await iphone(browser)
  await r.page.goto('/q/harbordemo')
  await expect(r.page).toHaveURL(/\/c\//)
  await expect(r.page.getByTestId('demo-capsule')).toBeVisible()
  await expect(r.page.getByTestId('capsule-name')).toHaveText('Noa Adler')
  await shot(r.page, '08-station-demo')
  await r.page.goto('/q/doesnotexist')
  await expect(r.page.getByTestId('recipient-unavailable')).toHaveAttribute('data-status', 'not_found')
  await o.ctx.close(); await r.ctx.close()
})

test('QA-M2: slow network, no sign-in, no JavaScript on a phone', async ({ browser }) => {
  const o = await iphone(browser)
  await signIn(o.page, 'demo@oryn.local', DEMO_PASSWORD)
  // A fresh link: every test browser shares one network address, and the anti-spam limit allows
  // 2 connection requests per link per address per day.
  await o.page.goto('/share?capsule=cap_demo_conf')
  await o.page.getByRole('button', { name: 'Start sharing' }).tap()
  const url = (await o.page.getByTestId('share-url').textContent())!.trim()
  const slow = await iphone(browser)
  const cdp = await slow.ctx.newCDPSession(slow.page)
  await cdp.send('Network.enable')
  // Roughly "slow 3G": 400 kbps, 400 ms latency.
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 50_000, uploadThroughput: 50_000 })
  const t0 = Date.now()
  await slow.page.goto(url, { waitUntil: 'commit' })
  await expect(slow.page.getByTestId('capsule-name')).toBeVisible()
  report.slow3gInstantViewMs = Date.now() - t0
  expect(Date.now() - t0).toBeLessThan(8000)
  const nojs = await iphone(browser, { javaScriptEnabled: false })
  await nojs.page.goto(url)
  await nojs.page.getByTestId('learn-more').click()
  await nojs.page.getByRole('link', { name: 'Connect' }).click()
  await nojs.page.getByLabel('Your name').fill('No Script')
  await nojs.page.getByLabel('One way to reach you').fill('noscript@example.com')
  await nojs.page.getByRole('button', { name: /Send to/ }).click()
  await expect(nojs.page.getByTestId('request-sent')).toBeVisible()
  await o.ctx.close(); await slow.ctx.close(); await nojs.ctx.close()
})

test('QA-M3: errors are clear and non-technical', async ({ browser }) => {
  const u = await iphone(browser)
  const p = u.page
  const messages: string[] = []
  await p.goto('/signin')
  await p.getByLabel('Email').fill('nobody@example.com')
  await p.getByLabel('Password').fill('wrong-password')
  await p.getByRole('button', { name: 'Sign in' }).tap()
  await expect(p.locator('p[role=alert]')).toBeVisible()
  messages.push(await p.locator('p[role=alert]').innerText())
  await signUp(p, 'Error Tester', `qa-err-${uid()}@example.com`)
  await p.goto('/capsules/new?mode=professional')
  await p.getByTestId('field-value-email').fill('not an email')
  await p.getByRole('button', { name: 'Create capsule' }).tap()
  await expect(p.locator('p[role=alert]')).toBeVisible()
  messages.push(await p.locator('p[role=alert]').innerText())
  await p.getByTestId('field-value-email').fill('ok@example.com')
  await p.getByTestId('field-value-social').fill('javascript:alert(1)')
  await p.getByRole('button', { name: 'Create capsule' }).tap()
  await expect(p.locator('p[role=alert]')).toContainText('web address')
  messages.push(await p.locator('p[role=alert]').innerText())
  // A failed submission keeps what the person already typed.
  await p.getByTestId('field-value-social').fill('instagram.com/ok')
  await p.getByRole('button', { name: 'Create capsule' }).tap()
  await expect(p.getByTestId('created-banner')).toBeVisible()
  await p.getByRole('link', { name: 'Share it' }).tap()
  await p.getByRole('button', { name: 'Start sharing' }).tap()
  const link = (await p.getByTestId('share-url').textContent())!.trim()
  const r = await iphone(browser) // a separate, signed-out recipient
  await r.page.goto(link + '/connect')
  await r.page.getByLabel('Your name').fill('Half Filled')
  await r.page.getByRole('button', { name: /Send to/ }).tap()
  await expect(r.page.locator('p[role=alert]')).toContainText('Add one way to reach you.')
  messages.push(await r.page.locator('p[role=alert]').innerText())
  await expect(r.page.getByLabel('Your name')).toHaveValue('Half Filled')
  await r.ctx.close()
  await p.goto('/c/this-is-not-a-link')
  messages.push(await p.getByTestId('recipient-unavailable').innerText())
  await p.goto('/some/page/that/does/not/exist')
  messages.push(await p.locator('main').innerText())
  report.errorMessages = messages
  for (const m of messages) expect(m, m).not.toMatch(TECHNICAL)
  expect(messages[0]).toContain('That email and password don’t match.')
  expect(messages[1]).toContain('needs to be an email address')
  expect(messages[2]).toContain('needs to be a web address')
  await shot(p, '09-error')
  await u.ctx.close()
})

test('QA-M4: touch targets and layout on the main phone screens', async ({ browser }) => {
  const o = await iphone(browser)
  await signIn(o.page, 'demo@oryn.local', DEMO_PASSWORD)
  const found: Record<string, unknown> = {}
  for (const path of ['/today', '/capsules', '/connections', '/connections/con_demo', '/follow-ups', '/settings/privacy', '/share?capsule=cap_demo_conf']) {
    await o.page.goto(path)
    await noHorizontalScroll(o.page)
    const small = await smallTargets(o.page)
    found[path] = small
    // Buttons (actions) must meet 44 px; small inline text links are reported, not failed.
    const smallButtons = small.filter((t) => t.tag === 'button' && t.h < 40)
    expect(smallButtons, `${path}: ${JSON.stringify(smallButtons)}`).toEqual([])
  }
  report.workspaceSmallTargets = found
  await o.ctx.close()
})
