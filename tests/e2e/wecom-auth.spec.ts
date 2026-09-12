import { expect, test, type BrowserContext } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import {
  encryptSecret,
  randomToken,
  tokenHash,
  FLOW_COOKIE,
  BROWSER_COOKIE,
} from '../../src/lib/wecom/security'

const prisma = new PrismaClient()
const prefix = `wecom-e2e-${process.pid}`
const password = 'test-only-password'
let adminId = ''
let memberId = ''
let ownsConfig = false
let publicOrigin = ''

test.beforeAll(async ({}, testInfo) => {
  publicOrigin = new URL(testInfo.project.use.baseURL!).origin
  if (await prisma.wecomAuthConfig.findUnique({ where: { id: 1 } }))
    throw new Error('WeCom E2E requires an unconfigured local test database')
  // The test-run environment supplies the same synthetic key to the local Next server.
  if (!process.env.WECOM_SECRET_KEY)
    throw new Error('Set synthetic WECOM_SECRET_KEY for these tests')
  const encoded = await hash(password, 10)
  adminId = (
    await prisma.user.create({
      data: {
        username: `${prefix}-admin`,
        password: encoded,
        roles: { create: { role: 'SUPER_ADMIN' } },
      },
    })
  ).id
  memberId = (
    await prisma.user.create({
      data: {
        username: `${prefix}-member`,
        password: encoded,
        roles: { create: { role: 'STORE_ADMIN' } },
      },
    })
  ).id
  await prisma.wecomAuthConfig.create({
    data: {
      corpId: prefix,
      agentId: '123',
      publicOrigin,
      encryptedSecret: encryptSecret('synthetic-secret'),
      enabled: true,
      autoLogin: true,
      revision: 1,
    },
  })
  ownsConfig = true
})

test.afterAll(async () => {
  if (ownsConfig) {
    await prisma.wecomAuthChallenge.deleteMany({})
    await prisma.wecomAuthConfig.deleteMany({ where: { corpId: prefix } })
  }
  await prisma.approvalLog.deleteMany({
    where: { operatedBy: { in: [adminId, memberId].filter(Boolean) } },
  })
  await prisma.userRole.deleteMany({
    where: { userId: { in: [adminId, memberId].filter(Boolean) } },
  })
  await prisma.user.deleteMany({ where: { id: { in: [adminId, memberId].filter(Boolean) } } })
  await prisma.$disconnect()
})

test.beforeEach(async () => {
  await prisma.externalIdentity.deleteMany({ where: { organizationId: prefix } })
  await prisma.wecomAuthConfig.update({
    where: { id: 1 },
    data: { enabled: true, autoLogin: true, publicOrigin },
  })
})

async function seedBindingFlow(context: BrowserContext, baseURL: string) {
  const flow = randomToken()
  const browser = randomToken()
  const config = await prisma.wecomAuthConfig.findUniqueOrThrow({ where: { id: 1 } })
  await prisma.wecomAuthChallenge.create({
    data: {
      id: tokenHash(flow),
      browserHash: tokenHash(browser),
      stage: 'bind',
      revision: config.revision,
      subjectId: 'member-userid',
      returnPath: '/mobile/home',
      expiresAt: new Date(Date.now() + 300000),
    },
  })
  await context.addCookies(
    [FLOW_COOKIE, BROWSER_COOKIE].map((name, index) => ({
      name,
      value: index === 0 ? flow : browser,
      url: baseURL,
      httpOnly: true,
      sameSite: 'Lax' as const,
    }))
  )
  return flow
}

test('first-time member enters a password, binds and logs in on mobile', async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seedBindingFlow(context, baseURL!)
  await page.goto('/login/wecom-bind')
  await expect(page.getByRole('heading', { name: '关联现有账号' })).toBeVisible()
  await page.getByLabel('用户名或手机号').fill(`${prefix}-member`)
  await page.getByLabel('密码', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: '关联并登录' }).click()
  await expect(page.getByRole('alert').filter({ hasText: '用户名或密码错误' })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('wecom-binding-mobile.png'),
    animations: 'disabled',
  })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.screenshot({
    path: testInfo.outputPath('wecom-binding-desktop.png'),
    animations: 'disabled',
  })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByRole('button', { name: '关联并登录' }).click()
  await expect(page).toHaveURL(/\/mobile\/home$/)
  expect(await prisma.externalIdentity.count({ where: { userId: memberId } })).toBe(1)
  const session = await page.request.get('/api/auth/session')
  expect(session.ok()).toBe(true)
})

test('cancels a pending association and rejects cross-origin binding', async ({
  page,
  context,
  baseURL,
}) => {
  const flow = await seedBindingFlow(context, baseURL!)
  const rejected = await page.request.post('/api/auth/wecom/bind', {
    headers: { Origin: 'https://evil.example.test' },
    data: { identifier: `${prefix}-member`, password },
  })
  expect(rejected.status()).toBe(403)
  await page.goto('/login/wecom-bind')
  await page.getByRole('link', { name: '取消关联，使用账号登录' }).click()
  await expect(page).toHaveURL(/\/login\?local=1$/)
  expect(await prisma.wecomAuthChallenge.findUnique({ where: { id: tokenHash(flow) } })).toBeNull()
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible()
})

test('administrator can save masked configuration, prebind and revoke a mapping', async ({
  page,
}, testInfo) => {
  const login = await page.request.post('/api/auth/login', {
    data: { identifier: `${prefix}-admin`, password },
  })
  expect(login.ok()).toBe(true)
  await page.goto('/admin/system-config/wecom')
  await expect(page.getByRole('heading', { name: '企业微信登录', exact: true })).toBeVisible()
  await expect(page.getByLabel('应用 Secret', { exact: true })).toHaveValue('')
  await page.getByRole('switch', { name: '企业微信内自动登录', exact: true }).click()
  await page.getByRole('button', { name: '保存配置', exact: true }).click()
  await expect(page.getByText('企业微信配置已保存', { exact: true })).toBeVisible()
  await expect(page.getByLabel('应用 Secret', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: '预绑定账号' }).click()
  await page.getByLabel('系统用户名', { exact: true }).fill(`${prefix}-member`)
  await page.getByLabel('企业微信成员 UserID', { exact: true }).fill('prebound-member')
  await page.getByRole('button', { name: '确认绑定' }).click()
  await expect(page.getByRole('cell', { name: 'prebound-member', exact: true })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('wecom-settings-desktop.png'),
    animations: 'disabled',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByLabel('应用 Secret', { exact: true })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('wecom-settings-mobile.png'),
    animations: 'disabled',
    fullPage: true,
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: '解绑', exact: true }).click()
  await page.getByRole('button', { name: '解除绑定', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'prebound-member', exact: true })).toHaveCount(0)
})

test('enterprise client starts authorization, but logout and emergency login do not auto-loop', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ baseURL, userAgent: 'Mozilla/5.0 wxwork/4.1' })
  const page = await context.newPage()
  try {
    const login = await context.request.get('/login?redirect=%2Fmobile%2Fhome', { maxRedirects: 0 })
    expect(login.headers().location).toContain('/api/auth/wecom/start')
    const start = await context.request.get(login.headers().location!, { maxRedirects: 0 })
    expect(start.headers().location).toContain('scope=snsapi_base')
    const url = new URL(start.headers().location!)
    expect(url.searchParams.get('appid')).toBe(prefix)
    expect(url.searchParams.get('redirect_uri')).toBe(`${publicOrigin}/api/auth/wecom/callback`)
    await page.goto('/api/auth/logout')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible()
    await context.clearCookies()
    await page.goto('/login?local=1')
    await expect(page).toHaveURL(/local=1/)
    await expect(page.getByRole('link', { name: '企业微信登录' })).toBeVisible()
  } finally {
    await context.close()
  }
})

test('non-administrators cannot access the configuration', async ({ page }) => {
  await page.request.post('/api/auth/login', { data: { identifier: `${prefix}-member`, password } })
  await page.goto('/admin/system-config/wecom')
  await expect(page).not.toHaveURL(/system-config\/wecom/)
})

test('invalid callbacks return to local login', async ({ page }) => {
  await page.goto('/api/auth/wecom/callback?state=forged&code=forged')
  await expect(page).toHaveURL(/wecomError=1/)
  await expect(page.getByRole('alert').filter({ hasText: '企业微信登录未完成' })).toBeVisible()
})

test('administrator edits the public origin with live validation and immediate runtime effect', async ({
  page,
}, testInfo) => {
  await page.request.post('/api/auth/login', { data: { identifier: `${prefix}-admin`, password } })
  await page.goto('/admin/system-config/wecom')
  const address = page.getByLabel('公开登录地址', { exact: true })
  const callback = page.getByLabel('授权回调地址', { exact: true })
  await expect(address).toHaveValue(publicOrigin)
  await address.fill('https://new-login.example.test/path')
  await page.getByRole('button', { name: '保存配置', exact: true }).click()
  await expect(page.getByText('地址只能包含协议、域名和端口', { exact: true })).toBeVisible()
  await expect(callback).toHaveValue('')
  expect((await prisma.wecomAuthConfig.findUniqueOrThrow({ where: { id: 1 } })).publicOrigin).toBe(
    publicOrigin
  )
  await address.fill('https://new-login.example.test/')
  await expect(callback).toHaveValue('https://new-login.example.test/api/auth/wecom/callback')
  await page.getByRole('button', { name: '保存配置', exact: true }).click()
  await expect(page.getByText('企业微信配置已保存', { exact: true })).toBeVisible()
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(address).toHaveValue('https://new-login.example.test')
  await expect(page.getByRole('button', { name: '保存配置', exact: true })).toBeEnabled()
  await page.screenshot({
    path: testInfo.outputPath('wecom-origin-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: testInfo.outputPath('wecom-origin-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const guest = await page.context().browser()!.newContext({ baseURL: publicOrigin })
  try {
    const start = await guest.request.get('/api/auth/wecom/start', { maxRedirects: 0 })
    expect(start.headers().location).toBe(
      'https://new-login.example.test/api/auth/wecom/start?redirect=%2F'
    )
  } finally {
    await guest.close()
  }
})
