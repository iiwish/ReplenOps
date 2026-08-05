import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const projectRoot = path.resolve(__dirname, '..')

export default defineConfig({
  testDir: path.join(projectRoot, 'tests/e2e'),
  outputDir: path.join(projectRoot, 'test-results'),
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3001',
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
    command: process.env.CI ? 'PORT=3001 npm run start' : 'npm run dev -- --port 3001',
    cwd: projectRoot,
    url: 'http://127.0.0.1:3001/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
