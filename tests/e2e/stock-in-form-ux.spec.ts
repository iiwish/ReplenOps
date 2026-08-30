import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'

const prisma = new PrismaClient()
const suffix = `${process.pid}`.slice(-6).padStart(6, '0')
const username = `e2e-stock-in-ux-${process.pid}`
const password = 'e2e-only-password'
const warehouseCode = `ESW${suffix}`
const categoryCode = `ESC${suffix}`
const goodsCodes = [`ESG${suffix}A`, `ESG${suffix}B`]

test.beforeAll(async () => {
  await prisma.user.create({
    data: {
      username,
      password: await hash(password, 10),
      name: '入库体验测试员',
      roles: { create: { role: 'SUPER_ADMIN' } },
    },
  })
  await prisma.warehouse.create({
    data: { code: warehouseCode, name: '入库体验测试仓' },
  })
  const category = await prisma.goodsCategory.create({
    data: { code: categoryCode, name: '入库体验测试分类' },
  })
  await prisma.goods.createMany({
    data: goodsCodes.map((code, index) => ({
      code,
      name: `入库体验商品${index + 1}`,
      categoryId: category.id,
      unit: '件',
      defaultInPrice: 10 + index,
    })),
  })
})

test.afterAll(async () => {
  await prisma.authSession.deleteMany({ where: { user: { username } } })
  await prisma.stockInItem.deleteMany({ where: { goods: { code: { in: goodsCodes } } } })
  await prisma.inventoryLog.deleteMany({ where: { inventory: { goods: { code: { in: goodsCodes } } } } })
  await prisma.inventory.deleteMany({ where: { goods: { code: { in: goodsCodes } } } })
  await prisma.goods.deleteMany({ where: { code: { in: goodsCodes } } })
  await prisma.goodsCategory.deleteMany({ where: { code: categoryCode } })
  await prisma.warehouse.deleteMany({ where: { code: warehouseCode } })
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

test('adds multiple goods in one pass and protects unsaved stock-in work', async ({ page }) => {
  await page.goto('/admin/stock-in/new')
  await page.getByRole('button', { name: '添加商品' }).click()

  const goodsDialog = page.getByRole('dialog', { name: '选择商品' })
  await expect(goodsDialog).toBeVisible()
  for (const [index, code] of goodsCodes.entries()) {
    const row = goodsDialog.getByRole('row').filter({ hasText: code })
    await expect(row).toBeVisible()
    await row.getByRole('checkbox').check()
    await expect(goodsDialog.getByText(`已选 ${index + 1} 项`)).toBeVisible()
  }

  await goodsDialog.getByRole('button', { name: '添加 2 项' }).click()
  await expect(goodsDialog).toBeHidden()
  await expect(page.getByRole('cell', { name: '入库体验商品1', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: '入库体验商品2', exact: true })).toBeVisible()
  await expect(page.getByText('2 个商品', { exact: true })).toBeVisible()

  await page.getByRole('menuitem', { name: /系统设置/ }).click()
  const navigation = page.getByRole('menuitem', { name: '用户管理' })
  const dialogPromise = page.waitForEvent('dialog')
  await Promise.all([
    navigation.click(),
    dialogPromise.then(async (dialog) => {
      expect(dialog.message()).toContain('当前入库单尚未保存')
      await dialog.dismiss()
    }),
  ])
  await expect(page).toHaveURL(/\/admin\/stock-in\/new$/)

  await page.getByRole('button', { name: /取\s*消/ }).first().click()
  const discardDialog = page.getByRole('dialog', { name: '放弃未保存的入库单？' })
  await expect(discardDialog).toBeVisible()
  await discardDialog.getByRole('button', { name: /继\s*续\s*编\s*辑/ }).click()
  await expect(discardDialog).toBeHidden()
})

test('applies order filters only when queried and keeps them in the URL', async ({ page }) => {
  await page.goto('/admin/orders')

  const keyword = page.getByPlaceholder('搜索订单号或备注')
  await keyword.fill('  TEST-ORDER  ')
  await expect(page).not.toHaveURL(/keyword=/)

  await page.getByRole('button', { name: /查\s*询/ }).click()
  await expect(page).toHaveURL(/keyword=TEST-ORDER/)
  await expect(keyword).toHaveValue('TEST-ORDER')

  await page.getByRole('button', { name: /重\s*置/ }).click()
  await expect(page).not.toHaveURL(/keyword=/)
  await expect(keyword).toHaveValue('')
})
