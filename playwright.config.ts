import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3100)

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Phones run with a UTF-8 locale; without it Chromium on this Linux container can't name a Hebrew download.
    launchOptions: { env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } },
  },
  projects: [
    { name: 'phone', testMatch: 'demo.spec.ts', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', testMatch: 'demo.spec.ts', use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 900 } } },
    // iPhone screen size, touch and user agent. Rendered by Chromium: WebKit (Safari's engine) is not
    // installed in this environment, so Safari-specific behaviour still needs a real-device pass.
    {
      name: 'iphone',
      testMatch: 'qa.spec.ts',
      use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent },
    },
  ],
  webServer: {
    command: `rm -rf .data/e2e && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      ORYN_ALLOW_EMBEDDED_DB: 'true',
      ORYN_SEED_DEMO: 'true',
      ORYN_PGLITE_DIR: '.data/e2e',
      ORYN_SECRET: 'e2e-secret-e2e-secret-e2e-secret-0000',
      ORYN_INSECURE_COOKIES: 'true',
      ORYN_JOBS_INLINE: 'true',
      // Test-only value for the fictional local demo account. Not a real credential.
      // Test-only values. Not real credentials.
      CRON_SECRET: 'e2e-only-cron-secret',
      ORYN_DELETION_GRACE_DAYS: '0',
      ORYN_DEMO_PASSWORD: process.env.E2E_DEMO_PASSWORD ?? 'e2e-only-demo-password',
    },
  },
})
