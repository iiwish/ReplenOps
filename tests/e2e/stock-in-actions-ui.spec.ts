import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'

const prisma = new PrismaClient()
const suffix = `${process.pid}`.slice(-6).padStart(6, '0')
const username = `e2e-stock-in-actions-${process.pid}`
const password = 'e2e-only-password'
const warehouseCode = `SAW${suffix}`
const stockInCode = `SI-E2E-${suffix}`

let stockInId = 0

test.beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      username,
      password: await hash(password, 10),
      name: '入库操作测试员',
      roles: { create: { role: 'SUPER_ADMIN' } },
    },
  })
  const warehouse = await prisma.warehouse.create({
    data: { code: warehouseCode, name: '入库操作测试仓' },
  })
  const stockIn = await prisma.stockIn.create({
    data: {
      code: stockInCode,
      warehouseId: warehouse.id,
      createdBy: user.id,
      status: 'PENDING',
    },
  })
  stockInId = stockIn.id
})

test.afterAll(async () => {
  await prisma.authSession.deleteMany({ where: { user: { username } } })
  await prisma.stockIn.deleteMany({ where: { code: stockInCode } })
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

test('keeps cancel but removes reject from pending stock-in actions', async ({ page }) => {
  await page.goto(`/admin/stock-in?keyword=${stockInCode}`)
  const row = page.getByRole('row').filter({ hasText: stockInCode })

  await expect(row.getByRole('button', { name: '审批通过' })).toBeVisible()
  await expect(row.getByRole('button', { name: /取\s*消/ })).toBeVisible()
  await expect(row.getByRole('button', { name: '拒绝' })).toHaveCount(0)

  await page.goto(`/admin/stock-in/${stockInId}`)
  await expect(page.getByRole('button', { name: '审批通过' })).toBeVisible()
  await expect(page.getByRole('button', { name: /取\s*消/ })).toBeVisible()
  await expect(page.getByRole('button', { name: '拒绝' })).toHaveCount(0)
})

test('keeps cancel reason validation out of the browser error channel', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))

  await page.goto(`/admin/stock-in/${stockInId}`)
  await page.getByRole('button', { name: /取\s*消/ }).click()
  const dialog = page.getByRole('dialog', { name: '取消入库单' })
  await dialog.getByRole('button', { name: '确认取消' }).click()

  await expect(page.getByText('请填写取消原因')).toBeVisible()
  await expect(dialog).toBeVisible()
  expect(pageErrors).toEqual([])
})
