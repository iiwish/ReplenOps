import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const projectRoot = path.resolve(__dirname, '..')
const port = process.env.PLAYWRIGHT_PORT ?? '3001'
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`

export default defineConfig({
  testDir: path.join(projectRoot, 'tests/e2e'),
  outputDir: path.join(projectRoot, 'test-results'),
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
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
    command: process.env.CI ? `PORT=${port} npm run start` : `npm run dev -- --port ${port}`,
    cwd: projectRoot,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
