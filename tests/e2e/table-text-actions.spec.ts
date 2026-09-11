import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'

const prisma = new PrismaClient()
const code = `TA${process.pid}`
const username = `e2e-text-actions-${process.pid}`
const password = 'e2e-only-password'

test.beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      username,
      password: await hash(password, 10),
      roles: { create: { role: 'SUPER_ADMIN' } },
    },
  })
  const store = await prisma.store.create({ data: { code, name: '文字操作测试门店' } })
  const warehouse = await prisma.warehouse.create({ data: { code, name: '文字操作测试仓' } })
  await prisma.order.create({
    data: { code, storeId: store.id, createdBy: user.id, status: 'PENDING' },
  })
  await prisma.stockIn.create({
    data: { code, warehouseId: warehouse.id, createdBy: user.id, status: 'PENDING' },
  })
})

test.afterAll(async () => {
  await prisma.order.deleteMany({ where: { code } })
  await prisma.stockIn.deleteMany({ where: { code } })
  await prisma.store.deleteMany({ where: { code } })
  await prisma.warehouse.deleteMany({ where: { code } })
  await prisma.authSession.deleteMany({ where: { user: { username } } })
  await prisma.userRole.deleteMany({ where: { user: { username } } })
  await prisma.user.deleteMany({ where: { username } })
  await prisma.$disconnect()
})

test('keeps visible text actions inside fixed columns on desktop and mobile', async ({
  page,
}, testInfo) => {
  const login = await page.request.post('/api/auth/login', {
    data: { identifier: username, password },
  })
  expect(login.ok()).toBe(true)

  for (const width of [1122, 390]) {
    await page.setViewportSize({ width, height: 1038 })
    for (const [path, keyword, labels] of [
      ['orders', code, ['查看', '审批']],
      ['stock-in', code, ['查看', '编辑', '审批通过', '取消']],
      ['stores', code, ['编辑', '管理员', '禁用', '删除']],
      ['users', username, ['编辑', '更多']],
    ] as const) {
      await page.goto(`/admin/${path}?keyword=${keyword}`)
      const row = page.getByRole('row').filter({ hasText: keyword }).first()
      await expect(row).toBeVisible()
      const cell = row.getByRole('cell').last()
      await cell.scrollIntoViewIfNeeded()
      for (const label of labels) {
        const button = cell.locator('button').filter({ hasText: label })
        await expect(button).toBeVisible()
        await button.click({ trial: true })
        await expect(button).toBeInViewport()
        await expect(button).toHaveClass(/ant-btn-link/)
      }
      const overflow = await cell.evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        return Array.from(element.querySelectorAll('button')).some((button) => {
          const rect = button.getBoundingClientRect()
          return (
            rect.left < bounds.left ||
            rect.right > bounds.right + 1 ||
            rect.bottom > bounds.bottom + 1 ||
            button.scrollWidth > button.clientWidth + 1
          )
        })
      })
      expect(overflow, `${path} at ${width}px`).toBe(false)
      await page.screenshot({
        path: testInfo.outputPath(`${path}-${width}.png`),
        animations: 'disabled',
      })
      if (path === 'users') {
        await cell.getByRole('button', { name: `更多用户操作：${username}` }).click()
        await expect(page.getByRole('menuitem', { name: /禁用用户/ })).toBeVisible()
        await page.keyboard.press('Escape')
      }
    }
  }
})
