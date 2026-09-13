import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'

const prisma = new PrismaClient()
const code = `PRINT-${process.pid}`
const username = `print-${process.pid}`
const password = 'print-e2e-only-password'
let stockOutId: number
let orderId: number

test.beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      username,
      password: await hash(password, 10),
      roles: { create: { role: 'SUPER_ADMIN' } },
    },
  })
  const store = await prisma.store.create({ data: { code, name: '打印测试门店' } })
  const warehouse = await prisma.warehouse.create({ data: { code, name: '打印测试仓库' } })
  const category = await prisma.goodsCategory.create({ data: { code, name: '打印测试分类' } })
  const items = []
  for (let index = 1; index <= 60; index += 1) {
    const goods = await prisma.goods.create({
      data: {
        code: `${code}-${index}`,
        name: index % 7 === 0 ? '长名称测试商品'.repeat(4) : `打印商品${index}`,
        categoryId: category.id,
        unit: '袋',
      },
    })
    items.push({
      goodsId: goods.id,
      goodsCodeSnapshot: `P${String(index).padStart(3, '0')}`,
      goodsNameSnapshot: goods.name,
      goodsSpecSnapshot: index % 7 === 0 ? '1000克/袋，独立包装' : '/',
      goodsUnitSnapshot: '袋',
      quantity: 1,
      snapshotCost: 1,
      salePrice: 2,
      profit: 1,
    })
  }
  const order = await prisma.order.create({
    data: {
      code,
      storeId: store.id,
      createdBy: user.id,
      status: 'COMPLETED',
      totalAmount: 120,
      remark: '这是用于验证长备注自动换行与打印分页的测试订单。'.repeat(5),
    },
  })
  orderId = order.id
  const stockOut = await prisma.stockOut.create({
    data: {
      code,
      orderId,
      warehouseId: warehouse.id,
      createdBy: user.id,
      status: 'COMPLETED',
      completedAt: new Date(),
      items: { create: items },
    },
  })
  stockOutId = stockOut.id
})

test.afterAll(async () => {
  await prisma.stockOut.deleteMany({ where: { code } })
  await prisma.order.deleteMany({ where: { code } })
  await prisma.goods.deleteMany({ where: { category: { code } } })
  await prisma.goodsCategory.deleteMany({ where: { code } })
  await prisma.store.deleteMany({ where: { code } })
  await prisma.warehouse.deleteMany({ where: { code } })
  await prisma.authSession.deleteMany({ where: { user: { username } } })
  await prisma.userRole.deleteMany({ where: { user: { username } } })
  await prisma.user.deleteMany({ where: { username } })
  await prisma.$disconnect()
})

for (const mode of ['page', 'modal'] as const) {
  test(`prints all rows with one final total from ${mode}`, async ({ page }, info) => {
    test.setTimeout(60000)
    expect(
      (
        await page.request.post('/api/auth/login', { data: { identifier: username, password } })
      ).ok()
    ).toBe(true)
    await page.goto(`/admin/stock-out/${stockOutId}${mode === 'page' ? '/print' : ''}`)
    if (mode === 'modal') await page.getByRole('button', { name: /打印出库单/ }).click()
    const content = page.locator('.stock-out-print-page')
    await expect(content.getByText('P060', { exact: true })).toBeVisible()
    await page.emulateMedia({ media: 'print' })
    await page.evaluate(() => document.fonts.ready)
    // Ant Layout's flex-child width must not collapse after switching to print blocks.
    expect((await content.boundingBox())!.width).toBeGreaterThan(700)
    if (mode === 'modal') {
      await expect(page.locator('.stock-out-print-modal')).toHaveCSS('opacity', '1')
      await expect(page.locator('.stock-out-print-modal .ant-modal-container')).toHaveCSS(
        'padding',
        '0px'
      )
      await expect(page.locator('.stock-out-print-modal .ant-modal-body')).toHaveCSS(
        'max-height',
        'none'
      )
    }
    await page.pdf({
      path: info.outputPath(`${mode}.pdf`),
      preferCSSPageSize: true,
      printBackground: true,
    })
    await expect(content.locator('tfoot')).toHaveCount(0)
    await expect(content.getByText('合计', { exact: true })).toHaveCount(1)
    await expect(content.locator('tbody tr')).toHaveCount(61)
    expect(await content.locator('thead').evaluate((el) => getComputedStyle(el).display)).toBe(
      'table-header-group'
    )
  })
}
