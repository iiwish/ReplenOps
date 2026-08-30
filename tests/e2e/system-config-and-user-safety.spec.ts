import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'

const prisma = new PrismaClient()
const username = `e2e-config-admin-${process.pid}`
const password = 'e2e-only-password'

test.beforeAll(async () => {
  await prisma.user.create({
    data: {
      username,
      password: await hash(password, 10),
      name: '配置安全测试管理员',
      roles: { create: { role: 'SUPER_ADMIN' } },
    },
  })
})

test.afterAll(async () => {
  await prisma.authSession.deleteMany({ where: { user: { username } } })
  await prisma.storeAdmin.deleteMany({ where: { user: { username } } })
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

test('warns before leaving an unsaved weekly schedule and confirms reset', async ({ page }) => {
  await page.goto('/admin/system-config')

  const mondaySwitch = page.getByRole('switch', { name: '周一报货开关' })
  await mondaySwitch.click()
  await expect(page.getByText('有未保存更改')).toBeVisible()
  await expect(page.getByRole('button', { name: '保存本周设置' })).toBeEnabled()

  const navigation = page.getByRole('menuitem', { name: '用户管理' })
  const dialogPromise = page.waitForEvent('dialog')
  await Promise.all([
    navigation.click(),
    dialogPromise.then(async (dialog) => {
      expect(dialog.message()).toContain('当前报货时间尚未保存')
      await dialog.dismiss()
    }),
  ])
  await expect(page).toHaveURL(/\/admin\/system-config$/)

  await mondaySwitch.click()
  await expect(page.getByText('所有更改已保存')).toBeVisible()
  await expect(page.getByRole('button', { name: '保存本周设置' })).toBeDisabled()

  await page.getByRole('button', { name: '恢复默认', exact: true }).click()
  const resetDialog = page.getByRole('dialog', { name: '恢复默认报货时间？' })
  await expect(resetDialog).toBeVisible()
  await resetDialog.getByRole('button', { name: '取 消' }).click()
  await expect(resetDialog).toBeHidden()
})

test('disables self-destructive operations in the user menu', async ({ page }) => {
  await page.goto('/admin/users')

  await page.getByRole('button', { name: `更多用户操作：${username}` }).click()
  await expect(page.getByRole('menuitem', { name: '禁用用户' })).toBeDisabled()
  await expect(page.getByRole('menuitem', { name: '删除用户' })).toBeDisabled()
})
