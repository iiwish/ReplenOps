import { expect, test } from '@playwright/test'

test('health endpoint reports a ready application', async ({ request }) => {
  const response = await request.get('/api/health')

  expect(response.ok()).toBe(true)
  await expect(response.json()).resolves.toMatchObject({ status: 'ok' })
})

test('login page identifies ReplenOps', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'ReplenOps' })).toBeVisible()
  await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
})
