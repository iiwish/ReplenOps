import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'

const prisma = new PrismaClient()
const suffix = `${process.pid}`.slice(-6).padStart(6, '0')
const username = `e2e-inventory-adjustment-${process.pid}`
const password = 'e2e-only-password'
const warehouseCode = `EIW${suffix}`
const categoryCode = `EIC${suffix}`
const goodsCode = `EIG${suffix}`

test.beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      username,
      password: await hash(password, 10),
      name: '库存调整测试员',
      roles: { create: { role: 'WAREHOUSE_MANAGER' } },
    },
  })
  const warehouse = await prisma.warehouse.create({
    data: { code: warehouseCode, name: '库存调整测试仓' },
  })
  const category = await prisma.goodsCategory.create({
    data: { code: categoryCode, name: '库存调整测试分类' },
  })
  const goods = await prisma.goods.create({
    data: {
      code: goodsCode,
      name: '库存调整测试商品',
      categoryId: category.id,
      unit: '件',
    },
  })
  const inventory = await prisma.inventory.create({
    data: {
      warehouseId: warehouse.id,
      goodsId: goods.id,
      quantity: 10,
      availableQuantity: 8,
      lockedQuantity: 2,
    },
  })

  await prisma.inventoryLog.create({
    data: {
      inventoryId: inventory.id,
      changeType: 'ADJUSTMENT',
      quantity: 1,
      beforeQty: 9,
      afterQty: 10,
      remark: '测试库存调整入口',
      operatedBy: user.id,
    },
  })
})

test.afterAll(async () => {
  await prisma.authSession.deleteMany({ where: { user: { username } } })
  await prisma.inventoryLog.deleteMany({ where: { inventory: { goods: { code: goodsCode } } } })
  await prisma.inventory.deleteMany({ where: { goods: { code: goodsCode } } })
  await prisma.goods.deleteMany({ where: { code: goodsCode } })
  await prisma.goodsCategory.deleteMany({ where: { code: categoryCode } })
  await prisma.warehouse.deleteMany({ where: { code: warehouseCode } })
  await prisma.userRole.deleteMany({ where: { user: { username } } })
  await prisma.user.deleteMany({ where: { username } })
  await prisma.$disconnect()
})

test('integrates inventory adjustment into the inventory change page', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', {
    data: { identifier: username, password },
  })
  expect(login.ok()).toBe(true)

  await page.goto('/admin/inventory/adjustment')

  await expect(page).toHaveURL(/\/admin\/inventory\/logs\?adjustment=1$/)
  await expect(page.getByRole('menuitem', { name: '库存调整' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /调整库存/ })).toBeVisible()

  const dialog = page.getByRole('dialog', { name: '调整库存' })
  await expect(dialog).toBeVisible()

  await dialog.getByRole('combobox', { name: '仓库' }).click()
  await page.locator('.ant-select-item-option').filter({ hasText: '库存调整测试仓' }).click()
  await dialog.getByRole('combobox', { name: '商品' }).fill(goodsCode)
  await page.locator('.ant-select-item-option').filter({ hasText: goodsCode }).click()

  await expect(dialog).toContainText('总库存')
  await expect(dialog).toContainText('可用库存')
  await expect(dialog).toContainText('锁定库存')
  await expect(dialog).toContainText('10件')
  await expect(dialog).toContainText('8件')
  await expect(dialog).toContainText('2件')

  const quantityInput = dialog.getByRole('spinbutton', { name: '调整后库存数量' })
  await quantityInput.fill('10')
  await expect(dialog.getByText('库存数量未发生变化')).toBeVisible()
  await expect(dialog.getByRole('button', { name: '提交调整' })).toBeDisabled()

  await quantityInput.fill('7')
  await dialog.getByRole('textbox', { name: '调整原因' }).fill('月末盘点复核')
  await dialog.getByRole('button', { name: '提交调整' }).click()

  const confirmation = page.getByRole('dialog', { name: '确认提交库存调整？' })
  await expect(confirmation).toContainText('库存调整测试仓 · 库存调整测试商品')
  await expect(confirmation).toContainText('库存将从 10 调整为 7 件')
  await expect(confirmation).toContainText('-3 件')
  await expect(confirmation).toContainText('原因：月末盘点复核')
  await confirmation.getByRole('button', { name: /返\s*回\s*核\s*对/ }).click()
  await expect(confirmation).toBeHidden()
})
