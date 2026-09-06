import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { deferred } from '../helpers/deferred'

const prisma = new PrismaClient()
const username = `e2e-mobile-navigation-${process.pid}`
const password = 'e2e-only-mobile-navigation-password'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

test.beforeAll(async () => {
  await prisma.user.create({
    data: {
      username,
      password: await hash(password, 10),
      roles: { create: { role: 'STORE_ADMIN' } },
    },
  })
})

test.afterAll(async () => {
  await prisma.authSession.deleteMany({ where: { user: { username } } })
  await prisma.userRole.deleteMany({ where: { user: { username } } })
  await prisma.user.deleteMany({ where: { username } })
  await prisma.$disconnect()
})

test.beforeEach(async ({ page }) => {
  const login = await page.request.post('/api/auth/login', {
    data: { identifier: username, password },
  })
  expect(login.ok()).toBe(true)
})

async function holdOrder(page: Page) {
  const gate = deferred<void>()
  await page.route('**/mobile/order?*', async (route) => {
    if (route.request().headers()['rsc'] === '1') await gate.promise
    await route.continue()
  })
  return () => gate.resolve()
}

test('immediately selects the destination and shows loading before a slow response', async ({
  page,
}, testInfo) => {
  const release = await holdOrder(page)
  await page.goto('/mobile/profile')
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible()
  try {
    await page.getByRole('link', { name: '下单', exact: true }).tap()
    await expect(page.getByRole('status', { name: '正在加载页面' })).toBeVisible({ timeout: 1000 })
    await expect(page.getByRole('heading', { name: '下单', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: '下单', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    )
    await expect(page.getByRole('button', { name: '退出登录' })).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath('mobile-navigation-loading.png'),
      animations: 'disabled',
    })
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 844 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      )
      await expect(page.getByRole('status', { name: '正在加载页面' })).toBeVisible()
      await expect(page.getByRole('navigation', { name: '底部导航' })).toBeVisible()
      await page.screenshot({
        path: testInfo.outputPath(`mobile-navigation-${width}.png`),
        animations: 'disabled',
      })
    }
  } finally {
    release()
  }
  await expect(page).toHaveURL(/\/mobile\/order$/)
  await expect(page.getByRole('status', { name: '正在加载页面' })).toBeHidden()
  await page.goBack()
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible()
  await expect(page.getByRole('link', { name: '我的', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  )
})

test('can change destination while another tab is still loading and only selects one tab', async ({
  page,
}) => {
  const release = await holdOrder(page)
  await page.goto('/mobile/profile')
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible()
  try {
    await page.getByRole('link', { name: '下单', exact: true }).tap()
    await expect(page.getByRole('status', { name: '正在加载页面' })).toBeVisible({ timeout: 1000 })
    await page.getByRole('link', { name: '订单', exact: true }).tap()
    await expect(page).toHaveURL(/\/mobile\/orders$/)
    await expect(page.getByRole('link', { name: '订单', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    )
    await expect(page.locator('nav a[aria-current="page"]')).toHaveCount(1)
  } finally {
    release()
  }
  await expect(page.getByRole('status', { name: '正在加载页面' })).toBeHidden()
  await expect(page).toHaveURL(/\/mobile\/orders$/)
})

test('respects a cancelled link navigation without hiding the current page', async ({ page }) => {
  await page.goto('/mobile/profile')
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible()
  // Exercise the same capture-phase cancellation used by the shared unsaved-changes guard.
  await page.evaluate(() => {
    document.addEventListener(
      'click',
      (event) => {
        event.preventDefault()
        event.stopPropagation()
      },
      { capture: true, once: true }
    )
  })
  await page.getByRole('link', { name: '下单', exact: true }).tap()
  await expect(page).toHaveURL(/\/mobile\/profile$/)
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible()
  await expect(page.getByRole('status', { name: '正在加载页面' })).toBeHidden()
})
