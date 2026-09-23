import { expect, test } from '@playwright/test'

test.skip(process.env.DEMO_MODE !== 'true', 'Requires a seeded demo database')

test('demo login only offers scoped store and warehouse access', async ({ browser, request }) => {
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ??
    `${process.env.CI ? 'https' : 'http'}://localhost:${process.env.PLAYWRIGHT_PORT ?? '3001'}`
  const rejected = await request.post(new URL('/api/auth/demo', baseURL).toString(), {
    headers: { Origin: 'https://untrusted.example' },
    data: { role: 'store' },
  })
  expect(rejected.status()).toBe(404)

  const storeContext = await browser.newContext({ baseURL })
  const storePage = await storeContext.newPage()
  await storePage.goto('/login')
  await expect(storePage.getByRole('button', { name: '门店端' })).toBeVisible()
  await storePage.getByRole('button', { name: '门店端' }).click()
  await storePage.waitForURL(/\/mobile(?:\/|$)/)
  await expect(storePage.getByText('演示门店员').first()).toBeVisible()
  await storeContext.close()

  const warehouseContext = await browser.newContext({ baseURL })
  const warehousePage = await warehouseContext.newPage()
  await warehousePage.goto('/login')
  await warehousePage.getByRole('button', { name: '仓库端' }).click()
  await warehousePage.waitForURL(/\/admin(?:\/|$)/)
  await warehouseContext.close()
})
