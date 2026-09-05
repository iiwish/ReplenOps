import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { deferred } from '../helpers/deferred'

const prisma = new PrismaClient()
const username = `e2e-navigation-${process.pid}`
const password = 'e2e-only-navigation-password'

test.setTimeout(60000)

test.beforeAll(async () => {
  await prisma.user.create({
    data: {
      username,
      password: await hash(password, 10),
      roles: { create: { role: 'SUPER_ADMIN' } },
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

async function holdStockOut(page: Page) {
  const gate = deferred<void>()
  await page.route('**/admin/stock-out?*', async (route) => {
    if (route.request().headers()['rsc'] === '1') await gate.promise
    await route.continue()
  })
  return () => gate.resolve()
}

test('shows the target menu and loading state before a slow response, then renders the page', async ({
  page,
}, testInfo) => {
  await page.goto('/admin/stock-in')
  const release = await holdStockOut(page)
  try {
    await page.getByRole('menuitem', { name: '出库管理', exact: true }).click()
    await expect(page.getByRole('status', { name: '正在加载页面' })).toBeVisible({ timeout: 1000 })
    await expect(page.getByRole('menuitem', { name: '出库管理', exact: true })).toHaveClass(
      /ant-menu-item-selected/
    )
    await expect(page.locator('.ant-breadcrumb')).toContainText('出库管理')
    await expect(page.getByRole('columnheader', { name: '入库单号' })).toBeHidden()
    await page.screenshot({
      path: testInfo.outputPath('navigation-loading-desktop.png'),
      animations: 'disabled',
    })
  } finally {
    release()
  }
  await expect(page).toHaveURL(/\/admin\/stock-out$/)
  await expect(page.getByRole('status', { name: '正在加载页面' })).toBeHidden()
  await expect(page.getByRole('columnheader', { name: '出库单号' })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/admin\/stock-in$/)
  await expect(page.getByRole('menuitem', { name: '入库管理', exact: true })).toHaveClass(
    /ant-menu-item-selected/
  )
  await page.goForward()
  await expect(page).toHaveURL(/\/admin\/stock-out$/)
  await expect(page.getByRole('status', { name: '正在加载页面' })).toBeHidden()
})

test('allows another menu selection while the first navigation is waiting', async ({ page }) => {
  await page.goto('/admin/stock-in')
  const release = await holdStockOut(page)
  try {
    await page.getByRole('menuitem', { name: '出库管理', exact: true }).click()
    await expect(page.getByRole('status', { name: '正在加载页面' })).toBeVisible({ timeout: 1000 })
    await page.getByRole('menuitem', { name: '库存查询', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/inventory\/query$/)
    await expect(page.getByRole('menuitem', { name: '库存查询', exact: true })).toHaveClass(
      /ant-menu-item-selected/
    )
  } finally {
    release()
  }
  await expect(page.getByRole('status', { name: '正在加载页面' })).toBeHidden()
  await expect(page).toHaveURL(/\/admin\/inventory\/query$/)
})

test('keeps the form and current menu when leaving unsaved work is cancelled', async ({ page }) => {
  await page.goto('/admin/stock-in/new')
  await page.getByLabel('备注').fill('尚未保存的导航测试')
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('menuitem', { name: '出库管理', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/stock-in\/new$/)
  await expect(page.getByLabel('备注')).toHaveValue('尚未保存的导航测试')
  await expect(page.getByRole('status', { name: '正在加载页面' })).toBeHidden()
  await expect(page.getByRole('menuitem', { name: '入库管理', exact: true })).toHaveClass(
    /ant-menu-item-selected/
  )

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('menuitem', { name: '出库管理', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/stock-out$/)
})

test('keeps the loading skeleton within a narrow content area', async ({ page }, testInfo) => {
  await page.goto('/admin/stock-in')
  const release = await holdStockOut(page)
  try {
    await page.getByRole('menuitem', { name: '出库管理', exact: true }).click()
    await expect(page.getByRole('status', { name: '正在加载页面' })).toBeVisible()
    await page.getByRole('button', { name: '收起侧栏' }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.mouse.move(380, 820)
    const loading = page.getByRole('status', { name: '正在加载页面' })
    await expect(loading).toBeVisible()
    expect(await loading.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true
    )
    await expect(page.locator('.ant-menu-submenu-popup:visible')).toHaveCount(0)
    await page.screenshot({
      path: testInfo.outputPath('navigation-loading-mobile.png'),
      animations: 'disabled',
    })
  } finally {
    release()
  }
  await expect(page).toHaveURL(/\/admin\/stock-out$/)
  await expect(page.getByRole('status', { name: '正在加载页面' })).toBeHidden()
})

test('offers retry on server errors and keeps the sidebar usable', async ({ page }) => {
  await page.goto('/admin/stock-out?status=INVALID_STATUS')
  await expect(page.getByText('页面加载失败', { exact: true })).toBeVisible()
  const request = page.waitForRequest(
    (request) => request.url().includes('/admin/stock-out?') && request.headers()['rsc'] === '1'
  )
  await page.getByRole('button', { name: '重新加载' }).click()
  await request
  await expect(page.getByText('页面加载失败', { exact: true })).toBeVisible()
  await page.getByRole('menuitem', { name: '入库管理', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/stock-in$/)
  await expect(page.getByRole('columnheader', { name: '入库单号' })).toBeVisible()
})

test('respects manual group collapse through filtering, navigation, history and reload', async ({
  page,
}) => {
  await page.goto('/admin/inventory/query')
  const navigation = page.getByRole('navigation', { name: '主导航' })
  const inventory = navigation.getByRole('menuitem', { name: /库存管理/ })
  const masterData = navigation.getByRole('menuitem', { name: /基础资料/ })
  await expect(inventory).toHaveAttribute('aria-expanded', 'true')
  await inventory.click()
  await expect(inventory).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('.ant-breadcrumb')).toContainText('库存查询')
  await expect(inventory.locator('..')).toHaveClass(/ant-menu-submenu-selected/)
  await page.getByText('全部状态', { exact: true }).click()
  await page.getByText('有库存', { exact: true }).click()
  await expect(page).toHaveURL(/stockStatus=has_stock/)
  await expect(inventory).toHaveAttribute('aria-expanded', 'false')
  await masterData.click()
  await navigation.getByRole('menuitem', { name: /报表分析/ }).click()
  await expect(inventory).toHaveAttribute('aria-expanded', 'false')
  await navigation.getByRole('menuitem', { name: '商品档案', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/goods$/)
  await expect(masterData).toHaveAttribute('aria-expanded', 'true')
  await page.goBack()
  await expect(page).toHaveURL(/\/admin\/inventory\/query/)
  await expect(inventory).toHaveAttribute('aria-expanded', 'true')
  await inventory.click()
  await page.reload()
  await expect(inventory).toHaveAttribute('aria-expanded', 'true')
})

test('supports keyboard collapse and keeps icon popups independent of inline groups', async ({
  page,
}, testInfo) => {
  await page.goto('/admin/inventory/query')
  const navigation = page.getByRole('navigation', { name: '主导航' })
  const inventory = navigation.getByRole('menuitem', { name: /库存管理/ })
  const reports = navigation.getByRole('menuitem', { name: /报表分析/ })
  await inventory.focus()
  await inventory.press('Enter')
  await expect(inventory).toHaveAttribute('aria-expanded', 'false')
  await expect(inventory).toBeFocused()
  await inventory.press('Enter')
  await expect(inventory).toHaveAttribute('aria-expanded', 'true')
  await inventory.press('Enter')
  await reports.click()
  await page.getByRole('button', { name: '收起侧栏' }).click()
  await page.mouse.move(1100, 50)
  await expect(page.locator('.ant-menu-submenu-popup:visible')).toHaveCount(0)
  await inventory.hover()
  await expect(page.getByRole('menuitem', { name: '入库管理', exact: true })).toBeVisible()
  await page.getByRole('menuitem', { name: '入库管理', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/stock-in$/)
  await page.mouse.move(1100, 50)
  await expect(page.locator('.ant-menu-submenu-popup:visible')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: testInfo.outputPath('sidebar-icons-mobile.png'),
    animations: 'disabled',
  })
  await page.setViewportSize({ width: 1132, height: 1028 })
  await page.getByRole('button', { name: '展开侧栏' }).click()
  await expect(inventory).toHaveAttribute('aria-expanded', 'true')
  await expect(reports).toHaveAttribute('aria-expanded', 'true')
  await inventory.click()
  await page.getByRole('button', { name: '收起侧栏' }).click()
  await page.getByRole('button', { name: '展开侧栏' }).click()
  await expect(inventory).toHaveAttribute('aria-expanded', 'false')
  await expect(reports).toHaveAttribute('aria-expanded', 'true')
  await expect(navigation.getByRole('menuitem', { name: '库存分析', exact: true })).toBeVisible()
  await expect
    .poll(() =>
      navigation
        .getByRole('menuitem', { name: '库存分析', exact: true })
        .evaluate((element) => element.parentElement?.getBoundingClientRect().height ?? 0)
    )
    .toBeGreaterThan(80)
  await page.screenshot({
    path: testInfo.outputPath('sidebar-current-group-closed.png'),
    animations: 'disabled',
  })
})

test('scrolls navigation independently while keeping the brand fixed in a short viewport', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1132, height: 600 })
  await page.goto('/admin/inventory/query')
  const navigation = page.getByRole('navigation', { name: '主导航' })
  for (const name of ['报表分析', '基础资料', '系统设置']) {
    await navigation.getByRole('menuitem', { name: new RegExp(name) }).click()
  }
  const brand = page.locator('aside').getByText('ReplenOps', { exact: true })
  const before = await brand.boundingBox()
  await navigation.getByRole('menuitem', { name: '审计日志', exact: true }).scrollIntoViewIfNeeded()
  await expect(brand).toBeInViewport()
  expect((await brand.boundingBox())?.y).toBe(before?.y)
  expect(await navigation.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await page.screenshot({
    path: testInfo.outputPath('sidebar-independent-scroll.png'),
    animations: 'disabled',
  })
})

test('records menu request timings without artificial delays', async ({ page }, testInfo) => {
  await page.goto('/admin/stock-in')
  const measurements: Array<{ path: string; totalMs: number; waitMs: number }> = []
  for (const path of ['stock-out', 'stock-in', 'stock-out', 'stock-in', 'stock-out', 'stock-in']) {
    const startedAt = await page.evaluate(() => performance.now())
    await page
      .getByRole('menuitem', { name: path === 'stock-out' ? '出库管理' : '入库管理', exact: true })
      .click()
    await expect(page).toHaveURL(new RegExp(`/admin/${path}$`))
    await expect(
      page.getByRole('columnheader', { name: path === 'stock-out' ? '出库单号' : '入库单号' })
    ).toBeVisible()
    const requests = await page.evaluate(
      ({ path, startedAt }) =>
        performance
          .getEntriesByType('resource')
          .filter(
            (entry): entry is PerformanceResourceTiming =>
              entry instanceof PerformanceResourceTiming &&
              entry.startTime >= startedAt &&
              new URL(entry.name).pathname === `/admin/${path}`
          )
          .map((entry) => ({
            path,
            totalMs: entry.duration,
            waitMs: entry.responseStart - entry.requestStart,
          })),
      { path, startedAt }
    )
    // A client-cache hit may navigate without a network request.
    measurements.push(...requests)
  }
  await testInfo.attach('menu-request-timings', {
    body: JSON.stringify(measurements, null, 2),
    contentType: 'application/json',
  })
  console.log('Local menu request timings:', JSON.stringify(measurements))
})
