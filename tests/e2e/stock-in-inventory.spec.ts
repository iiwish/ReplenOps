import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'

const prisma = new PrismaClient()
const prefix = `SIV${process.pid}`
const username = `e2e-stock-in-inventory-${process.pid}`
const password = 'e2e-only-password'
let stockInId: number

test.beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      username,
      password: await hash(password, 10),
      name: '库存列测试员',
      roles: { create: { role: 'SUPER_ADMIN' } },
    },
  })
  const first = await prisma.warehouse.create({
    data: { code: `${prefix}A`, name: `${prefix}仓库一` },
  })
  const second = await prisma.warehouse.create({
    data: { code: `${prefix}B`, name: `${prefix}仓库二` },
  })
  const category = await prisma.goodsCategory.create({
    data: { code: prefix, name: '库存列测试分类' },
  })
  const goods = await prisma.goods.create({
    data: {
      code: `${prefix}G`,
      name: `${prefix}商品`,
      unit: '千克',
      categoryId: category.id,
      defaultInPrice: 10,
    },
  })
  await prisma.inventory.createMany({
    data: [
      {
        warehouseId: first.id,
        goodsId: goods.id,
        quantity: 18.125,
        availableQuantity: 15.125,
        lockedQuantity: 3,
      },
      {
        warehouseId: second.id,
        goodsId: goods.id,
        quantity: 99,
        availableQuantity: 99,
        isDeleted: true,
      },
    ],
  })
  const stockIn = await prisma.stockIn.create({
    data: {
      code: prefix,
      warehouseId: first.id,
      createdBy: user.id,
      items: { create: { goodsId: goods.id, quantity: 2, unitPrice: 10, totalPrice: 20 } },
    },
  })
  stockInId = stockIn.id
})

test.afterAll(async () => {
  await prisma.stockInItem.deleteMany({ where: { stockIn: { code: prefix } } })
  await prisma.stockIn.deleteMany({ where: { code: prefix } })
  await prisma.inventory.deleteMany({ where: { goods: { code: `${prefix}G` } } })
  await prisma.goods.deleteMany({ where: { code: `${prefix}G` } })
  await prisma.goodsCategory.deleteMany({ where: { code: prefix } })
  await prisma.warehouse.deleteMany({ where: { code: { in: [`${prefix}A`, `${prefix}B`] } } })
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

test('shows warehouse physical stock in selection and details, and refreshes on warehouse change', async ({
  page,
}, testInfo) => {
  await page.goto('/admin/stock-in/new')
  await page.getByRole('combobox', { name: '选择仓库' }).fill(`${prefix}仓库一`)
  await page.getByText(`${prefix}仓库一 (${prefix}A)`, { exact: true }).click()
  await page.getByRole('button', { name: '添加商品' }).click()
  const dialog = page.getByRole('dialog', { name: '选择商品' })
  await dialog.getByPlaceholder('搜索商品名称或编码').fill(`${prefix}G`)
  const row = dialog.getByRole('row').filter({ hasText: `${prefix}G` })
  await expect(dialog.getByRole('row')).toHaveCount(2)
  await expect(dialog.getByRole('columnheader', { name: '现有库存' })).toBeVisible()
  await expect(row.getByRole('cell', { name: '18.125', exact: true })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('inventory-selector-desktop.png'),
    fullPage: true,
  })
  await row.getByRole('checkbox').check()
  await dialog.getByRole('button', { name: '添加 1 项' }).click()
  await expect(dialog).toBeHidden()
  const itemRow = page
    .getByRole('region', { name: '商品明细' })
    .getByRole('row')
    .filter({ hasText: `${prefix}G` })
  await expect(itemRow.getByRole('cell', { name: '18.125', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: '选择仓库' }).fill(`${prefix}仓库二`)
  await page.getByText(`${prefix}仓库二 (${prefix}B)`, { exact: true }).click()
  await expect(itemRow.getByRole('cell', { name: '0', exact: true })).toBeVisible()
  await expect(itemRow.getByRole('cell', { name: '18.125', exact: true })).toHaveCount(0)
})

test('loads existing items on edit without including the pending receipt quantity', async ({
  page,
}, testInfo) => {
  await page.goto(`/admin/stock-in/${stockInId}/edit`)
  const row = page.getByRole('row').filter({ hasText: `${prefix}G` })
  await expect(row.getByRole('cell', { name: '18.125', exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('inventory-edit-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(row.getByRole('cell', { name: '18.125', exact: true })).toBeAttached()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
  await row.getByRole('cell', { name: '18.125', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('inventory-edit-mobile.png'), fullPage: true })
})

test('shows failed inventory reads as unavailable rather than zero', async ({ page }) => {
  await page.route(`**/admin/stock-in/${stockInId}/edit`, async (route) => {
    if (route.request().method() === 'POST') await route.abort('failed')
    else await route.continue()
  })
  await page.goto(`/admin/stock-in/${stockInId}/edit`)
  const row = page.getByRole('row').filter({ hasText: `${prefix}G` })
  await expect(row.getByRole('cell', { name: '加载失败', exact: true })).toBeVisible()
  await expect(row.getByRole('cell', { name: '0', exact: true })).toHaveCount(0)
  await page.unroute(`**/admin/stock-in/${stockInId}/edit`)
  await page.getByRole('button', { name: '添加商品' }).click()
  await expect(
    page
      .getByRole('region', { name: '商品明细' })
      .getByRole('cell', { name: '18.125', exact: true })
  ).toBeVisible()
})
