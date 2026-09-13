import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'
import { getShanghaiClock } from '../../src/lib/shanghai-time'

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
let categoryId: number

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
  categoryId = category.id
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
  for (let index = 0; index < 7; index += 1) {
    await prisma.goods.create({
      data: {
        code: `${goodsCode}-${index}`,
        name: `验收商品${index}号`,
        spec: index === 1 ? '1000克/袋' : null,
        unit: '袋',
        categoryId: category.id,
        partnerPrice: 18.5,
        inventories: {
          create: {
            warehouseId: warehouse.id,
            quantity: index === 6 ? 0 : 38,
            availableQuantity: index === 6 ? 0 : 38,
          },
        },
      },
    })
  }
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
  await prisma.inventory.deleteMany({ where: { goods: { category: { code: categoryCode } } } })
  await prisma.goods.deleteMany({ where: { category: { code: categoryCode } } })
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
  const sidebar = page.getByRole('complementary', { name: '商品分类' })
  const categoryCount = await sidebar.getByRole('button').count()
  await search.fill('巧克力')
  await expect(sidebar.getByRole('button')).toHaveCount(categoryCount)
  await expect(sidebar.getByRole('button', { name: '移动验收分类', exact: true })).toBeEnabled()
  await search.fill('没有这个商品-分类回归')
  await expect(sidebar.getByRole('button')).toHaveCount(categoryCount)
  await expect(sidebar.locator('button:enabled')).toHaveCount(0)
  await expect(page.getByText('未找到匹配商品', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('categories-no-matches.png') })
  await page.getByRole('button', { name: '清除搜索', exact: true }).tap()
  await expect(sidebar.locator('button:enabled')).toHaveCount(categoryCount)
  await expect(search).toHaveValue('')
  await expect(search).toBeFocused()
  await search.blur()
  await expect(page.getByText('订单已撤回', { exact: true })).toBeHidden({ timeout: 10000 })
  await page.getByRole('button', { name: '移动验收分类', exact: true }).tap()
  await page.getByRole('button', { name: '加购 验收商品0号', exact: true }).tap()
  await expect(page.getByText('已添加到购物车', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '加购 验收商品6号', exact: true })).toBeDisabled()
  const goodsCard = page
    .locator(`#category-${categoryId}`)
    .getByRole('heading', { name: '巧克力块1000g', exact: true })
    .locator('xpath=ancestor::div[contains(@class, "shadow-sm")][1]')
  for (const width of [320, 360, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 740 })
    await goodsCard.getByRole('button', { name: '增加数量' }).tap()
    await expect(goodsCard.getByRole('textbox', { name: '商品数量' })).toHaveValue('3')
    await goodsCard.getByRole('button', { name: '减少数量' }).tap()
    await expect(goodsCard.getByRole('textbox', { name: '商品数量' })).toHaveValue('2')
    const bounds = await goodsCard.boundingBox()
    expect(bounds!.height).toBeLessThanOrEqual(90)
    const increase = await goodsCard.getByRole('button', { name: '增加数量' }).boundingBox()
    expect(increase!.x + increase!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width)
    expect(increase!.x).toBeGreaterThanOrEqual(bounds!.x)
    const cart = await page
      .getByRole('button', { name: '查看', exact: true })
      .locator('../..')
      .boundingBox()
    const scroller = await page.locator('section .mobile-scroll').boundingBox()
    expect(scroller!.y + scroller!.height).toBeLessThanOrEqual(cart!.y + 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`goods-layout-${width}.png`) })
  }
  await page.setViewportSize({ width: 360, height: 740 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '20px'
  })
  const enlargedCard = await goodsCard.boundingBox()
  const enlargedControl = await goodsCard.getByRole('button', { name: '增加数量' }).boundingBox()
  expect(enlargedControl!.x + enlargedControl!.width).toBeLessThanOrEqual(
    enlargedCard!.x + enlargedCard!.width
  )
  await page.screenshot({ path: info.outputPath('goods-layout-large-font.png') })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = ''
  })
  await page.locator('section .mobile-scroll').evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  // 数据库排序规则不同，指定验收商品不一定是列表最后一项。
  const lastCard = page
    .locator('section .mobile-scroll')
    .getByRole('heading', { level: 3 })
    .last()
    .locator('xpath=ancestor::div[contains(@class, "shadow-sm")][1]')
  const lastBounds = await lastCard.boundingBox()
  const listBounds = await page.locator('section .mobile-scroll').boundingBox()
  expect(
    Math.abs(lastBounds!.y + lastBounds!.height - listBounds!.y - listBounds!.height)
  ).toBeLessThan(12)
  await page.goto('/mobile/order/cart')
  await expect(page).toHaveURL(/\/mobile\/order$/)
})

test('names stock shortages, preserves quantities, and distinguishes cross-warehouse orders', async ({
  page,
}, info) => {
  const dayOfWeek = getShanghaiClock().dayOfWeek
  const schedule = await prisma.orderingSchedule.findUnique({ where: { dayOfWeek } })
  const extra = await prisma.warehouse.create({ data: { code: `MPX${suffix}`, name: '多仓验收' } })
  try {
    await prisma.orderingSchedule.upsert({
      where: { dayOfWeek },
      create: { dayOfWeek, isActive: true, startTime: '00:00', endTime: '23:59' },
      update: { isActive: true, startTime: '00:00', endTime: '23:59' },
    })
    await prisma.order.deleteMany({ where: { id: pendingId } })
    const goods = await prisma.goods.findUniqueOrThrow({ where: { code: goodsCode } })
    await page.goto('/mobile/order')
    await page
      .locator(`#category-${categoryId}`)
      .getByRole('button', { name: '加购 巧克力块1000g', exact: true })
      .tap()
    const card = page
      .locator(`#category-${categoryId}`)
      .getByRole('heading', { name: '巧克力块1000g', exact: true })
      .locator('xpath=ancestor::div[contains(@class, "shadow-sm")][1]')
    await card.getByRole('button', { name: '增加数量' }).tap()
    await prisma.inventory.updateMany({
      where: { goodsId: goods.id },
      data: { availableQuantity: 1, quantity: 1 },
    })
    await page.getByRole('button', { name: '结算', exact: true }).tap()
    await page.getByRole('button', { name: '确认结算', exact: true }).tap()
    await expect(page.getByRole('alert')).toContainText(`巧克力块1000g（${goodsCode}）`)
    await expect(page.getByRole('alert')).toContainText('订购 2 包，单仓最多可订 1 包，缺少 1 包')
    await page.screenshot({ path: info.outputPath('stock-shortage.png') })
    await page.getByRole('button', { name: '返回修改', exact: true }).tap()
    await expect(card.getByRole('textbox', { name: '商品数量' })).toHaveValue('2')
    await expect(card).toContainText('单仓可订 1 包')
    await card.getByRole('button', { name: '减少数量' }).tap()
    await prisma.inventory.updateMany({
      where: { goodsId: goods.id },
      data: { availableQuantity: 0, quantity: 0 },
    })
    await prisma.inventory.create({
      data: { warehouseId: extra.id, goodsId: goods.id, quantity: 3, availableQuantity: 3 },
    })
    await page.reload()
    await page.getByRole('button', { name: '加购 验收商品0号', exact: true }).tap()
    await page.getByRole('button', { name: '结算', exact: true }).tap()
    await page.getByRole('button', { name: '确认结算', exact: true }).tap()
    await expect(page.getByRole('alert')).toContainText('无法同仓配齐')
    await expect(page.getByRole('alert')).toContainText('验收商品0号')
    await expect(page.getByRole('alert')).toContainText('巧克力块1000g')
    await page.screenshot({ path: info.outputPath('stock-cross-warehouse.png') })
    expect(
      await prisma.order.count({ where: { store: { code: storeCode }, status: 'PENDING' } })
    ).toBe(0)
    expect(
      await prisma.inventory.count({ where: { goodsId: goods.id, lockedQuantity: { gt: 0 } } })
    ).toBe(0)
  } finally {
    await prisma.inventory.deleteMany({ where: { warehouseId: extra.id } })
    await prisma.warehouse.delete({ where: { id: extra.id } })
    if (schedule)
      await prisma.orderingSchedule.update({
        where: { dayOfWeek },
        data: {
          isActive: schedule.isActive,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        },
      })
    else await prisma.orderingSchedule.delete({ where: { dayOfWeek } })
  }
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
