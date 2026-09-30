import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3100)

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 900 } } },
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
      ORYN_DEMO_PASSWORD: process.env.E2E_DEMO_PASSWORD ?? 'e2e-only-demo-password',
    },
  },
})
