import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'

const prisma = new PrismaClient()
const suffix = `${process.pid}`.slice(-6).padStart(6, '0')
const password = 'e2e-only-password'
const financeUsername = `e2e-pack-finance-${process.pid}`
const storeUsername = `e2e-pack-store-${process.pid}`
const storeCode = `PW${suffix}`
const containerCodes = [`PC${suffix}A`, `PC${suffix}B`]

test.beforeAll(async () => {
  const passwordHash = await hash(password, 10)
  const [financeUser, storeUser] = await prisma.$transaction([
    prisma.user.create({
      data: {
        username: financeUsername,
        password: passwordHash,
        name: '包装物财务测试员',
        roles: { create: { role: 'FINANCE' } },
      },
    }),
    prisma.user.create({
      data: {
        username: storeUsername,
        password: passwordHash,
        name: '包装物门店测试员',
        roles: { create: { role: 'STORE_ADMIN' } },
      },
    }),
  ])
  void financeUser

  const store = await prisma.store.create({
    data: {
      code: storeCode,
      name: '包装物流转测试门店',
      storeAdmins: { create: { userId: storeUser.id } },
    },
  })
  const [crate, pallet] = await prisma.$transaction([
    prisma.container.create({
      data: { code: containerCodes[0]!, name: '冷链周转箱', unit: '只', deposit: 20 },
    }),
    prisma.container.create({
      data: { code: containerCodes[1]!, name: '配送托盘', unit: '套', deposit: 30 },
    }),
  ])
  await prisma.containerTracking.createMany({
    data: [
      {
        storeId: store.id,
        containerId: crate.id,
        totalBorrowed: 7,
        currentBorrowed: 7,
        pendingReturnQuantity: 2,
      },
      {
        storeId: store.id,
        containerId: pallet.id,
        totalBorrowed: 3,
        currentBorrowed: 3,
      },
    ],
  })
})

test.afterAll(async () => {
  await prisma.authSession.deleteMany({
    where: { user: { username: { in: [financeUsername, storeUsername] } } },
  })
  await prisma.containerTracking.deleteMany({
    where: { container: { code: { in: containerCodes } } },
  })
  await prisma.container.deleteMany({ where: { code: { in: containerCodes } } })
  await prisma.storeAdmin.deleteMany({ where: { store: { code: storeCode } } })
  await prisma.store.deleteMany({ where: { code: storeCode } })
  await prisma.userRole.deleteMany({
    where: { user: { username: { in: [financeUsername, storeUsername] } } },
  })
  await prisma.user.deleteMany({
    where: { username: { in: [financeUsername, storeUsername] } },
  })
  await prisma.$disconnect()
})

test('shows a single packaging workspace and read-only actions for finance', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', {
    data: { identifier: financeUsername, password },
  })
  expect(login.ok()).toBe(true)

  await page.goto('/admin/dashboard')
  await expect(page.getByRole('menuitem', { name: '包装物' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '系统设置' })).toHaveCount(0)

  await page.getByRole('menuitem', { name: '基础资料' }).click()
  await page.getByRole('menuitem', { name: '商品档案' }).click()
  await expect(page.getByRole('heading', { name: '商品档案' })).toBeVisible()
  await expect(page.getByRole('button', { name: /新增商品/ })).toHaveCount(0)

  await page.getByRole('menuitem', { name: '包装物' }).click()
  await expect(page).toHaveURL(/\/admin\/containers(?:\?view=outstanding)?$/)
  await expect(page.getByRole('heading', { name: '包装物' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '在外包装物' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '归还验收' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '全部台账' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '包装物设置' })).toHaveCount(0)
})

test('supports multi-item mobile returns with one title and real units', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const login = await page.request.post('/api/auth/login', {
    data: { identifier: storeUsername, password },
  })
  expect(login.ok()).toBe(true)

  await page.goto('/mobile/container-return')
  await expect(page.getByRole('heading', { name: '包装物归还' })).toHaveCount(1)
  await expect(page.getByText('包装物流转测试门店', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('可归还 5 只')).toBeVisible()
  await expect(page.getByText('可归还 3 套')).toBeVisible()

  const selections = page.getByRole('checkbox', { name: '加入本次归还' })
  await expect(selections).toHaveCount(2)
  await selections.nth(0).check()
  await selections.nth(1).check()
  await page.getByRole('button', { name: /提交 2 种包装物/ }).click()

  const dialog = page.getByRole('dialog', { name: '确认归还申请' })
  await expect(dialog.getByText('冷链周转箱')).toBeVisible()
  await expect(dialog.getByText('5 只')).toBeVisible()
  await expect(dialog.getByText('配送托盘')).toBeVisible()
  await expect(dialog.getByText('3 套')).toBeVisible()
})
