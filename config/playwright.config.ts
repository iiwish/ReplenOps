import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { defineConfig, devices } from '@playwright/test'

const projectRoot = path.resolve(__dirname, '..')
const port = process.env.PLAYWRIGHT_PORT ?? '3001'
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`

// Synthetic credentials stay in the test process and its local web server, never in .env.
const wecomTestEnv = {
  WECOM_SECRET_KEY: process.env.WECOM_SECRET_KEY || randomBytes(32).toString('hex'),
  WECOM_AUTH_ORIGIN: '',
}
Object.assign(process.env, wecomTestEnv)

export default defineConfig({
  testDir: path.join(projectRoot, 'tests/e2e'),
  outputDir: path.join(projectRoot, 'test-results'),
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  // E2E specs share one local database and dev server, so serialize them to avoid cross-test races.
  workers: 1,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  reporter: [
    ['html', { open: 'never', outputFolder: path.join(projectRoot, 'playwright-report') }],
    ['list'],
  ],
  webServer: {
    env: wecomTestEnv,
    command: process.env.CI ? `PORT=${port} npm run start` : `npm run dev -- --port ${port}`,
    cwd: projectRoot,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
