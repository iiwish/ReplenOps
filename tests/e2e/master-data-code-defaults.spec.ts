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
  const hydrationErrors: string[] = []
  page.on('console', (entry) => {
    if (entry.type() === 'error' && /hydration|server rendered html/i.test(entry.text())) {
      hydrationErrors.push(entry.text())
    }
  })

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
  await page.getByRole('tab', { name: '包装物设置' }).click()
  await page.getByRole('button', { name: /新增包装物/ }).click()
  const containerDialog = page.getByRole('dialog', { name: '新增包装物' })
  await expect(containerDialog.getByRole('textbox', { name: /包装物编码/ })).toHaveValue(
    expectedContainerCode
  )
  await containerDialog.getByRole('textbox', { name: '名称' }).fill('未保存包装物')
  await containerDialog.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: /新增包装物/ }).click()
  await expect(
    page.getByRole('dialog', { name: '新增包装物' }).getByRole('textbox', { name: '名称' })
  ).toHaveValue('')
  expect(hydrationErrors).toEqual([])
})
