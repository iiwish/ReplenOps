import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'

const prisma = new PrismaClient()
const suffix = `${process.pid}`.slice(-6).padStart(6, '0')
const username = `e2e-store-admin-${process.pid}`
const password = 'e2e-only-password'
const storeCode = `ES${suffix}`
const administratorName = '门店列表测试管理员'

test.beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      username,
      password: await hash(password, 10),
      name: administratorName,
      roles: { create: { role: 'WAREHOUSE_MANAGER' } },
    },
  })
  await prisma.store.create({
    data: {
      code: storeCode,
      name: '管理员展示测试门店',
      storeAdmins: { create: { userId: user.id } },
    },
  })
})

test.afterAll(async () => {
  await prisma.storeAdmin.deleteMany({ where: { store: { code: storeCode } } })
  await prisma.store.deleteMany({ where: { code: storeCode } })
  await prisma.userRole.deleteMany({ where: { user: { username } } })
  await prisma.user.deleteMany({ where: { username } })
  await prisma.$disconnect()
})

test('shows administrator names in the store list without a separate menu page', async ({
  page,
}) => {
  const login = await page.request.post('/api/auth/login', {
    data: { identifier: username, password },
  })
  expect(login.ok()).toBe(true)

  await page.goto(`/admin/stores?keyword=${encodeURIComponent(administratorName)}`)

  await expect(page.getByRole('menuitem', { name: '门店档案' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '门店管理员' })).toHaveCount(0)
  await expect(page.getByRole('cell', { name: administratorName })).toBeVisible()
  await expect(page.getByRole('button', { name: 'user 管理员' })).toHaveCount(0)
})
