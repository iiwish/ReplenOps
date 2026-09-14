import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'

const prisma = new PrismaClient()
const username = `e2e-mobile-${process.pid}`
const password = 'e2e-only-password'

test.beforeAll(async () => {
  await prisma.user.deleteMany({ where: { username } })
  await prisma.user.create({
    data: {
      username,
      password: await hash(password, 10),
      roles: { create: { role: 'STORE_ADMIN' } },
    },
  })
})

test.afterAll(async () => {
  await prisma.userRole.deleteMany({ where: { user: { username } } })
  await prisma.user.deleteMany({ where: { username } })
  await prisma.$disconnect()
})

test('profile navigation does not revoke the mobile session', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', {
    data: {
      identifier: username,
      password,
    },
  })

  expect(login.ok()).toBe(true)

  await page.goto('/mobile/profile')
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible()

  const sessionStatus = await page.evaluate(async () => {
    const response = await fetch('/api/auth/session', { cache: 'no-store' })
    return response.status
  })
  expect(sessionStatus).toBe(200)

  await page.getByRole('link', { name: '首页' }).click()
  await expect(page).toHaveURL(/\/mobile\/home$/)
  await expect(page.getByText('工作台', { exact: true })).toBeVisible()

  await page.request.post('/api/auth/logout')
})

for (const width of [390, 1280]) {
  test(`profile avatar initials survive navigation and reload at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const browserErrors: string[] = []
    page.on('pageerror', (error) => browserErrors.push(error.message))
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        /hydration|did not match|server rendered/i.test(message.text())
      ) {
        browserErrors.push(message.text())
      }
    })

    const login = await page.request.post('/api/auth/login', {
      data: { identifier: username, password },
    })
    expect(login.ok()).toBe(true)

    const initials = page.getByText(username.substring(0, 2).toUpperCase(), { exact: true })
    const expectAvatar = async () => {
      await expect(initials).toBeVisible()
      await expect(initials).toHaveCSS('width', '64px')
      await expect(initials).toHaveCSS('height', '64px')
      await expect(page.getByRole('heading', { name: username, exact: true })).toBeVisible()
    }

    await page.goto('/mobile/profile')
    await expectAvatar()
    await page.getByRole('link', { name: '个人信息', exact: true }).click()
    await expect(page).toHaveURL(/\/mobile\/profile\/info$/)
    await expect(page.getByText('账号信息', { exact: true })).toBeVisible()
    await expectAvatar()
    await page.reload()
    await expectAvatar()
    await page.getByRole('link', { name: '我的', exact: true }).click()
    await expect(page).toHaveURL(/\/mobile\/profile$/)
    await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible()
    await expectAvatar()
    expect(browserErrors).toEqual([])
    await page.request.post('/api/auth/logout')
  })
}

test('logging out redirects other open application pages to login', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', {
    data: {
      identifier: username,
      password,
    },
  })
  expect(login.ok()).toBe(true)

  const otherPage = await page.context().newPage()
  await page.goto('/mobile/profile')
  await otherPage.goto('/mobile/home')
  await expect(otherPage.getByText('工作台', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '退出登录' }).click()

  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  await expect(otherPage).toHaveURL(/\/login(?:\?|$)/)
})
