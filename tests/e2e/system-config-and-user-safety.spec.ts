import { hash } from 'bcryptjs'
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'
import { brand } from '../../src/config/brand'

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

test('syncs saved branding to browser tabs, navigation and anonymous login', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120000)
  const originalConfig = await prisma.systemConfig.findUnique({ where: { id: 1 } })
  const name = `标签页测试-${process.pid}`
  const logo = readFileSync('public/icons/icon-192x192.png')
  const guest = await browser.newContext({ baseURL: testInfo.project.use.baseURL })

  try {
    await page.goto('/admin/system-config')
    await page.getByLabel('系统名称', { exact: true }).fill(name)
    await page.locator('#system-logo-upload').setInputFiles({
      name: 'brand.png',
      mimeType: 'image/png',
      buffer: logo,
    })
    await page.getByRole('button', { name: '保存配置', exact: true }).click()
    await expect(page.getByText('所有更改已保存')).toBeVisible()
    await expect(page).toHaveTitle(name)
    const icon = page.locator('link[rel="icon"]')
    await expect(icon).toHaveCount(1)
    await expect(icon).toHaveAttribute('href', /^\/favicon\.ico\?v=\w+$/)
    const iconUrl = (await icon.getAttribute('href'))!

    const iconResponse = await guest.request.get(iconUrl)
    expect(iconResponse.ok()).toBe(true)
    expect(iconResponse.headers()['content-type']).toBe('image/png')
    expect(await iconResponse.body()).toEqual(logo)
    expect(
      await page.evaluate(async (url) => {
        const image = new Image()
        image.src = url
        await image.decode()
        return image.naturalWidth
      }, iconUrl)
    ).toBe(192)

    await page.screenshot({
      path: testInfo.outputPath('branding-desktop.png'),
      animations: 'disabled',
    })
    await page.getByRole('menuitem', { name: '用户管理', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/users$/)
    await expect(page).toHaveTitle(name)
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', iconUrl)
    await page.reload()
    await expect(page).toHaveTitle(name)

    const login = await guest.newPage()
    await login.setViewportSize({ width: 390, height: 844 })
    await login.goto('/login')
    await expect(login).toHaveTitle(name)
    await expect(login.locator('link[rel="icon"]')).toHaveAttribute('href', iconUrl)
    await expect(login.getByRole('heading', { name, exact: true })).toBeVisible()
    await login.screenshot({
      path: testInfo.outputPath('branding-login-mobile.png'),
      animations: 'disabled',
    })

    await page.goto('/admin/system-config')
    await page.locator('#system-logo-upload').setInputFiles('public/icons/icon-512x512.png')
    await page.getByRole('button', { name: '保存配置', exact: true }).click()
    await expect(page.getByText('所有更改已保存')).toBeVisible()
    await expect(page.locator('link[rel="icon"]')).not.toHaveAttribute('href', iconUrl)
    const updatedIconUrl = (await page.locator('link[rel="icon"]').getAttribute('href'))!
    expect(await (await guest.request.get(updatedIconUrl)).body()).toEqual(
      readFileSync('public/icons/icon-512x512.png')
    )

    await page.getByRole('button', { name: '使用默认 Logo' }).click()
    await page.getByRole('button', { name: '保存配置', exact: true }).click()
    await expect(page.getByText('所有更改已保存')).toBeVisible()
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', brand.logoPath)
    await expect(page).toHaveTitle(name)
    await login.reload()
    await expect(login.locator('link[rel="icon"]')).toHaveAttribute('href', brand.logoPath)
  } finally {
    await guest.close()
    if (originalConfig) {
      await prisma.systemConfig.upsert({
        where: { id: 1 },
        create: originalConfig,
        update: originalConfig,
      })
    } else {
      await prisma.systemConfig.deleteMany({ where: { id: 1 } })
    }
  }
})

test('warns before leaving an unsaved weekly schedule and confirms reset', async ({ page }) => {
  await page.goto('/admin/system-config/ordering-schedule')

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
  await expect(page).toHaveURL(/\/admin\/system-config\/ordering-schedule$/)

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
