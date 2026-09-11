import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'

const prisma = new PrismaClient()
const code = `RL${process.pid}`
const username = `e2e-report-layout-${process.pid}`
const password = 'e2e-only-password'

test.beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      username,
      password: await hash(password, 10),
      roles: { create: { role: 'SUPER_ADMIN' } },
    },
  })
  const store = await prisma.store.create({ data: { code, name: '报表布局测试门店' } })
  const warehouse = await prisma.warehouse.create({ data: { code, name: '报表布局测试仓' } })
  const goods = await prisma.goods.create({
    data: {
      code,
      name: '报表布局测试商品',
      unit: '件',
      category: { create: { code, name: '报表布局测试分类' } },
    },
  })
  const order = await prisma.order.create({
    data: {
      code,
      storeId: store.id,
      createdBy: user.id,
      status: 'COMPLETED',
      totalAmount: 159660,
    },
  })
  await prisma.stockOut.create({
    data: {
      code,
      orderId: order.id,
      warehouseId: warehouse.id,
      status: 'COMPLETED',
      completedAt: new Date('2026-08-15T04:00:00Z'),
      items: {
        create: {
          goodsId: goods.id,
          quantity: 5322,
          salePrice: 30,
          snapshotCost: 20,
          profit: 53220,
        },
      },
    },
  })
})

test.afterAll(async () => {
  await prisma.stockOut.deleteMany({ where: { code } })
  await prisma.order.deleteMany({ where: { code } })
  await prisma.goods.deleteMany({ where: { code } })
  await prisma.goodsCategory.deleteMany({ where: { code } })
  await prisma.store.deleteMany({ where: { code } })
  await prisma.warehouse.deleteMany({ where: { code } })
  await prisma.authSession.deleteMany({ where: { user: { username } } })
  await prisma.userRole.deleteMany({ where: { user: { username } } })
  await prisma.user.deleteMany({ where: { username } })
  await prisma.$disconnect()
})

test('keeps report filters and summary compact without divider lines or overflow', async ({
  page,
}, testInfo) => {
  const login = await page.request.post('/api/auth/login', {
    data: { identifier: username, password },
  })
  expect(login.ok()).toBe(true)
  for (const width of [1440, 1122, 390]) {
    await page.setViewportSize({ width, height: 1038 })
    await page.goto(`/admin/reports/stock-out?month=2026-08&keyword=${code}`)
    const summary = page.locator('dl[aria-label="出库汇总"]')
    await expect(summary).toContainText('5,322.000')
    await expect(summary).toContainText('¥159,660.00')
    const layout = await summary.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return {
        height: rect.height,
        borderTop: style.borderTopWidth,
        borderBottom: style.borderBottomWidth,
        overflow: Array.from(el.querySelectorAll('dt, dd')).some((child) => {
          const bounds = child.getBoundingClientRect()
          return (
            bounds.right > rect.right + 1 ||
            bounds.left < rect.left ||
            child.scrollWidth > child.clientWidth + 1
          )
        }),
      }
    })
    expect(layout.borderTop).toBe('0px')
    expect(layout.borderBottom).toBe('0px')
    expect(layout.overflow).toBe(false)
    if (width >= 1024) expect(layout.height).toBeLessThanOrEqual(68)
    await expect(page.getByPlaceholder('出库单号或订单号')).toBeInViewport()
    await page.screenshot({
      path: testInfo.outputPath(`report-${width}.png`),
      animations: 'disabled',
    })
    await page.getByRole('button', { name: '导出 Excel' }).click()
    const dialog = page.getByRole('dialog', { name: '确认导出' })
    await expect(dialog).toContainText('2026-08')
    await dialog.getByRole('button', { name: /取\s*消/ }).click()
  }
  await page.getByPlaceholder('出库单号或订单号').fill(`${code}-empty`)
  await expect(page).toHaveURL(new RegExp(`keyword=${code}-empty`))
  await expect(page.locator('dl[aria-label="出库汇总"]')).toContainText('¥0.00')
})
