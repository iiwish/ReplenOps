import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'

const prisma = new PrismaClient()
const suffix = String(process.pid)
const username = `e2e-polish-${suffix}`
const password = 'e2e-only-polish-password'
const storeCode = `MP${suffix}`
const goodsCode = `MPG${suffix}`
const categoryCode = `MPC${suffix}`
const orderCode = `O-20260906-09259-${suffix}`
const shippedCode = `SO-POLISH-${suffix}`
let pendingId: number
let completedId: number

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

test.beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      username,
      password: await hash(password, 10),
      roles: { create: { role: 'STORE_ADMIN' } },
    },
  })
  const store = await prisma.store.create({
    data: {
      code: storeCode,
      name: '移动验收门店',
      storeAdmins: { create: { userId: user.id } },
    },
  })
  const category = await prisma.goodsCategory.create({
    data: { code: categoryCode, name: '移动验收分类' },
  })
  const goods = await prisma.goods.create({
    data: {
      code: goodsCode,
      name: '巧克力块1000g',
      unit: '包',
      categoryId: category.id,
      partnerPrice: 12,
    },
  })
  const warehouse = await prisma.warehouse.create({
    data: { code: `MPW${suffix}`, name: '移动验收仓库' },
  })
  await prisma.inventory.create({
    data: { goodsId: goods.id, warehouseId: warehouse.id, quantity: 10, availableQuantity: 10 },
  })
  const completed = await prisma.order.create({
    data: {
      code: orderCode,
      storeId: store.id,
      storeNameSnapshot: store.name,
      createdBy: user.id,
      status: 'COMPLETED',
      totalAmount: 24,
      items: { create: { goodsId: goods.id, quantity: 2, unitPrice: 12, totalPrice: 24 } },
    },
  })
  completedId = completed.id
  await prisma.stockOut.create({
    data: {
      code: shippedCode,
      orderId: completed.id,
      warehouseId: warehouse.id,
      createdBy: user.id,
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  })
  const pending = await prisma.order.create({
    data: {
      code: `OR-POLISH-${suffix}`,
      storeId: store.id,
      storeNameSnapshot: store.name,
      createdBy: user.id,
      totalAmount: 24,
      items: { create: { goodsId: goods.id, quantity: 2, unitPrice: 12, totalPrice: 24 } },
    },
  })
  pendingId = pending.id
})

test.afterAll(async () => {
  await prisma.stockOut.deleteMany({ where: { code: shippedCode } })
  await prisma.approvalLog.deleteMany({
    where: {
      operatedBy: {
        in: (await prisma.user.findMany({ where: { username }, select: { id: true } })).map(
          (u) => u.id
        ),
      },
    },
  })
  await prisma.order.deleteMany({ where: { id: { in: [pendingId, completedId] } } })
  await prisma.inventory.deleteMany({ where: { goods: { code: goodsCode } } })
  await prisma.goods.deleteMany({ where: { code: goodsCode } })
  await prisma.goodsCategory.deleteMany({ where: { code: categoryCode } })
  await prisma.warehouse.deleteMany({ where: { code: `MPW${suffix}` } })
  await prisma.storeAdmin.deleteMany({ where: { store: { code: storeCode } } })
  await prisma.store.deleteMany({ where: { code: storeCode } })
  await prisma.authSession.deleteMany({ where: { user: { username } } })
  await prisma.userRole.deleteMany({ where: { user: { username } } })
  await prisma.user.deleteMany({ where: { username } })
  await prisma.$disconnect()
})

test.beforeEach(async ({ page }) => {
  expect(
    (await page.request.post('/api/auth/login', { data: { identifier: username, password } })).ok()
  ).toBe(true)
})

test('keeps one compact order number, a single-line status and shipping reference', async ({
  page,
}, info) => {
  await page.goto(`/mobile/orders/${completedId}`)
  await expect(page.getByText(orderCode, { exact: true })).toHaveCount(1)
  await expect(page.getByText(shippedCode, { exact: true })).toBeVisible()
  for (const width of [390, 320, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    for (const text of [orderCode, '已完成']) {
      const dimensions = await page.getByText(text, { exact: true }).evaluate((el) => ({
        height: el.getBoundingClientRect().height,
        line: parseFloat(getComputedStyle(el).lineHeight),
      }))
      expect(dimensions.height).toBeLessThan(dimensions.line * 2)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`order-detail-${width}.png`) })
  }
})

test('docks withdraw above navigation and restores the items to the order page cart', async ({
  page,
}, info) => {
  await page.goto(`/mobile/orders/${pendingId}`)
  const button = page.getByRole('button', { name: '撤回订单', exact: true })
  await expect(button).toBeVisible()
  const nav = await page.getByRole('navigation', { name: '底部导航' }).boundingBox()
  const bar = await button.locator('..').boundingBox()
  expect(Math.abs(bar!.y + bar!.height - nav!.y)).toBeLessThan(2)
  await page.screenshot({ path: info.outputPath('order-withdraw-docked.png') })
  page.once('dialog', (dialog) => dialog.accept())
  await button.tap()
  await expect(page).toHaveURL(/\/mobile\/order$/)
  await expect(page.getByText('共 1 件商品', { exact: true })).toBeVisible()
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('erp-cart-storage') || '{}').state?.items?.[0]?.quantity
      )
    )
    .toBe(2)
  const search = page.getByRole('searchbox', { name: '搜索商品' })
  await search.fill('巧克力')
  await page.getByRole('button', { name: '清除搜索', exact: true }).tap()
  await expect(search).toHaveValue('')
  await expect(search).toBeFocused()
  await page.goto('/mobile/order/cart')
  await expect(page).toHaveURL(/\/mobile\/order$/)
})

test('has compact list cards and no duplicate home quick entry section', async ({ page }, info) => {
  await page.goto('/mobile/orders')
  const card = page.getByRole('link').filter({ hasText: orderCode })
  await expect(card).toContainText('订单详情')
  await expect(page.getByText('订单金额', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('order-list.png') })
  await page.goto('/mobile/home')
  await expect(page.getByText('数据概览', { exact: true })).toBeVisible()
  await expect(page.getByText('快速入口', { exact: true })).toHaveCount(0)
})

test('returns to home after explicitly logging out and signing in again', async ({ page }) => {
  await page.goto('/mobile/profile')
  await page.getByRole('button', { name: '退出登录', exact: true }).tap()
  await expect(page).toHaveURL(/\/login\?redirect=%2Fmobile%2Fhome$/)
  await page.getByLabel('用户名或手机号').fill(username)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByRole('button', { name: '登录', exact: true }).tap()
  await expect(page).toHaveURL(/\/mobile\/home$/)
})
