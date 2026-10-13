import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'

const prisma = new PrismaClient()
const prefix = `GUE${process.pid}`
const username = `e2e-goods-unit-${process.pid}`
const password = 'e2e-only-password'
const warning = '仅修改单位名称，不换算库存数量及价格'
let goodsId: number

test.beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      username,
      password: await hash(password, 10),
      name: '单位名称测试员',
      roles: { create: { role: 'SUPER_ADMIN' } },
    },
  })
  const category = await prisma.goodsCategory.create({
    data: { code: prefix, name: `${prefix}分类` },
  })
  const warehouse = await prisma.warehouse.create({
    data: { code: prefix, name: `${prefix}仓库` },
  })
  const goods = await prisma.goods.create({
    data: {
      code: `${prefix}G`,
      name: `${prefix}商品`,
      categoryId: category.id,
      unit: '箱',
      measureType: 'INT',
      costPrice: 12,
      partnerPrice: 15,
      defaultInPrice: 11,
    },
  })
  goodsId = goods.id
  await prisma.inventory.create({
    data: {
      warehouseId: warehouse.id,
      goodsId,
      quantity: 10,
      lockedQuantity: 2,
      availableQuantity: 8,
      avgCost: 11,
      totalCost: 110,
    },
  })
  await prisma.stockIn.create({
    data: {
      code: prefix,
      warehouseId: warehouse.id,
      createdBy: user.id,
      status: 'COMPLETED',
      totalAmount: 110,
      items: {
        create: {
          goodsId,
          goodsUnitSnapshot: '箱',
          measureTypeSnapshot: 'INT',
          quantity: 10,
          unitPrice: 11,
          totalPrice: 110,
        },
      },
    },
  })
})

test.afterAll(async () => {
  await prisma.approvalLog.deleteMany({
    where: { entityType: 'GOODS', entityId: String(goodsId) },
  })
  await prisma.stockInItem.deleteMany({ where: { stockIn: { code: prefix } } })
  await prisma.stockIn.deleteMany({ where: { code: prefix } })
  await prisma.inventory.deleteMany({ where: { goodsId } })
  await prisma.goods.deleteMany({ where: { code: `${prefix}G` } })
  await prisma.goodsCategory.deleteMany({ where: { code: prefix } })
  await prisma.warehouse.deleteMany({ where: { code: prefix } })
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

test('saves a used goods unit as a label and still rejects a measurement type change', async ({
  page,
}, testInfo) => {
  const inventoryBefore = await prisma.inventory.findFirstOrThrow({ where: { goodsId } })
  const snapshotBefore = await prisma.stockInItem.findFirstOrThrow({ where: { goodsId } })
  await page.goto(`/admin/goods?search=${prefix}G`)
  const row = page.getByRole('row').filter({ hasText: `${prefix}G` })
  await row.getByRole('button', { name: '编辑', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '编辑商品' })
  const unit = dialog.getByRole('textbox', { name: /单位/ })
  await expect(unit).toHaveValue('箱')
  await expect(dialog.getByText(warning, { exact: true })).toHaveCount(0)

  await unit.fill('瓶')
  const alert = dialog.getByRole('alert').filter({ hasText: warning })
  await expect(alert).toBeVisible()
  const desktopAlert = await alert.boundingBox()
  const desktopForm = await dialog.locator('form').boundingBox()
  expect(desktopAlert?.width).toBeCloseTo(desktopForm!.width, 0)
  await page.screenshot({
    path: testInfo.outputPath('unit-warning-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await unit.fill('箱')
  await expect(alert).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  await unit.fill('瓶')
  await expect(alert).toBeVisible()
  const mobileAlert = await alert.boundingBox()
  const mobileForm = await dialog.locator('form').boundingBox()
  const mobileUnit = await unit.boundingBox()
  expect(mobileAlert?.width).toBeCloseTo(mobileForm!.width, 0)
  expect(mobileAlert!.x).toBeGreaterThanOrEqual(0)
  expect(mobileAlert!.x + mobileAlert!.width).toBeLessThanOrEqual(390)
  expect(mobileUnit!.x + mobileUnit!.width).toBeLessThanOrEqual(mobileForm!.x + mobileForm!.width)
  await page.screenshot({
    path: testInfo.outputPath('unit-warning-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await dialog.getByRole('button', { name: /保\s*存/ }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('商品更新成功', { exact: true })).toBeVisible()

  const goodsAfter = await prisma.goods.findUniqueOrThrow({ where: { id: goodsId } })
  expect(goodsAfter.unit).toBe('瓶')
  expect(goodsAfter.measureType).toBe('INT')
  expect(Number(goodsAfter.costPrice)).toBe(12)
  expect(Number(goodsAfter.partnerPrice)).toBe(15)
  expect(Number(goodsAfter.defaultInPrice)).toBe(11)
  expect(await prisma.inventory.findFirstOrThrow({ where: { goodsId } })).toEqual(inventoryBefore)
  expect(await prisma.stockInItem.findFirstOrThrow({ where: { goodsId } })).toEqual(snapshotBefore)
  const audits = await prisma.approvalLog.findMany({
    where: { entityType: 'GOODS', entityId: String(goodsId), action: 'GOODS_UPDATE' },
  })
  expect(audits).toHaveLength(1)
  expect(audits[0]?.beforeJson).toMatchObject({ unit: '箱', measureType: 'INT' })
  expect(audits[0]?.afterJson).toMatchObject({ unit: '瓶', measureType: 'INT' })

  await page.setViewportSize({ width: 1280, height: 720 })
  await row.getByRole('button', { name: '编辑', exact: true }).click()
  await expect(unit).toHaveValue('瓶')
  await expect(alert).toHaveCount(0)
  await dialog.getByRole('radio', { name: /小数/ }).check()
  await dialog.getByRole('button', { name: /保\s*存/ }).click()
  const rejection = page.getByText(/已有库存或单据记录.*不能直接修改计量类型/)
  await expect(rejection).toBeVisible()
  expect(await rejection.textContent()).not.toContain('单位')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: /保\s*存/ })).toBeEnabled()
  expect(await prisma.goods.findUniqueOrThrow({ where: { id: goodsId } })).toEqual(goodsAfter)
  expect(
    await prisma.approvalLog.count({
      where: { entityType: 'GOODS', entityId: String(goodsId), action: 'GOODS_UPDATE' },
    })
  ).toBe(1)
})

test('does not show the label-only edit warning while creating goods', async ({ page }) => {
  await page.goto('/admin/goods')
  await page.getByRole('button', { name: /新增商品/ }).click()
  const dialog = page.getByRole('dialog', { name: '新增商品' })
  await dialog.getByRole('textbox', { name: /单位/ }).fill('瓶')
  await expect(dialog.getByText(warning, { exact: true })).toHaveCount(0)
})
