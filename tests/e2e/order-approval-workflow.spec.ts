import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'

const prisma = new PrismaClient()
const username = `e2e-order-review-${process.pid}`
const password = 'e2e-only-password'
const storeCode = `EO${`${process.pid}`.slice(-6).padStart(6, '0')}`
const categoryCode = `EOCAT-${process.pid}`
const goodsCode = `EOG-${process.pid}`
const containerCode = `EOC-${process.pid}`
let orderId: number

test.beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      username,
      password: await hash(password, 10),
      name: '订单审批测试员',
      roles: { create: { role: 'APPROVER' } },
    },
  })
  const store = await prisma.store.create({
    data: { code: storeCode, name: '订单审批测试门店' },
  })
  const category = await prisma.goodsCategory.create({
    data: { code: categoryCode, name: '订单审批测试分类' },
  })
  const goods = await prisma.goods.create({
    data: {
      code: goodsCode,
      name: '订单审批测试商品',
      categoryId: category.id,
      unit: '件',
    },
  })
  await prisma.container.create({
    data: {
      code: containerCode,
      name: '订单审批测试筐',
      unit: '个',
      goodsBindings: { create: { goodsId: goods.id, goodsQuantityPerContainer: 30 } },
    },
  })
  const order = await prisma.order.create({
    data: {
      code: `E2E-ORDER-${process.pid}`,
      storeId: store.id,
      storeNameSnapshot: store.name,
      createdBy: user.id,
      remark: '旧审批链接兼容测试',
      totalAmount: 62,
      items: {
        create: { goodsId: goods.id, quantity: 31, unitPrice: 2, totalPrice: 62 },
      },
    },
  })
  orderId = order.id
})

test.afterAll(async () => {
  await prisma.order.deleteMany({ where: { id: orderId } })
  await prisma.containerGoodsBinding.deleteMany({ where: { container: { code: containerCode } } })
  await prisma.container.deleteMany({ where: { code: containerCode } })
  await prisma.goods.deleteMany({ where: { code: goodsCode } })
  await prisma.goodsCategory.deleteMany({ where: { code: categoryCode } })
  await prisma.store.deleteMany({ where: { code: storeCode } })
  await prisma.authSession.deleteMany({ where: { user: { username } } })
  await prisma.userRole.deleteMany({ where: { user: { username } } })
  await prisma.user.deleteMany({ where: { username } })
  await prisma.$disconnect()
})

test('redirects the retired approval page into the order-list approval modal', async ({ page }) => {
  const hydrationErrors: string[] = []
  page.on('console', (entry) => {
    if (entry.type() === 'error' && entry.text().includes('Hydration failed')) {
      hydrationErrors.push(entry.text())
    }
  })

  const login = await page.request.post('/api/auth/login', {
    data: { identifier: username, password },
  })
  expect(login.ok()).toBe(true)

  await page.goto(`/admin/order-approval/${orderId}`)

  await expect(page).toHaveURL(new RegExp(`/admin/orders\\?status=PENDING&approval=${orderId}$`))
  const dialog = page.getByRole('dialog', { name: /审批订单/ })
  await expect(dialog).toBeVisible({ timeout: 15000 })
  await expect(dialog.getByText('订单审批测试门店')).toBeVisible()
  await expect(dialog.getByRole('heading', { name: '包装物明细' })).toBeVisible()
  await expect(
    dialog.getByRole('row', {
      name: `${containerCode} 订单审批测试筐 2个 订单审批测试商品：31件 ÷ 30件/个 = 2个`,
    })
  ).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '订单审批' })).toHaveCount(0)
  expect(hydrationErrors).toEqual([])
})
