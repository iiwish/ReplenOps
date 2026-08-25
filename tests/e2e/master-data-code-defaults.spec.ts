import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'
import { getNextContainerCode } from '../../src/lib/container-code-policy'
import { getNextGoodsCode } from '../../src/lib/goods-code-policy'

const prisma = new PrismaClient()
const username = `e2e-master-code-${process.pid}`
const password = 'e2e-only-password'
let expectedGoodsCode: string
let expectedContainerCode: string

test.beforeAll(async () => {
  const [goods, containers] = await Promise.all([
    prisma.goods.findMany({ select: { code: true } }),
    prisma.container.findMany({ select: { code: true } }),
  ])
  expectedGoodsCode = getNextGoodsCode(goods.map((item) => item.code))
  expectedContainerCode = getNextContainerCode(containers.map((item) => item.code))

  await prisma.user.create({
    data: {
      username,
      password: await hash(password, 10),
      name: '主数据编码测试员',
      roles: { create: { role: 'SUPER_ADMIN' } },
    },
  })
})

test.afterAll(async () => {
  await prisma.authSession.deleteMany({ where: { user: { username } } })
  await prisma.userRole.deleteMany({ where: { user: { username } } })
  await prisma.user.deleteMany({ where: { username } })
  await prisma.$disconnect()
})

test('prefills the next goods and container codes in create forms', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', {
    data: { identifier: username, password },
  })
  expect(login.ok()).toBe(true)

  await page.goto('/admin/goods')
  await page.getByRole('button', { name: /新增商品/ }).click()
  const goodsDialog = page.getByRole('dialog', { name: '新增商品' })
  await expect(goodsDialog.getByRole('textbox', { name: /商品编码/ })).toHaveValue(
    expectedGoodsCode
  )

  await page.goto('/admin/containers')
  await page.getByRole('button', { name: /新增包装物/ }).click()
  const containerDialog = page.getByRole('dialog', { name: '新增包装物' })
  await expect(containerDialog.getByRole('textbox', { name: /包装物编码/ })).toHaveValue(
    expectedContainerCode
  )
})
