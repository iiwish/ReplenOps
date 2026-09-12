import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'
import type { APIResponse } from '@playwright/test'
import { signAuthToken, verifyAuthTokenClaims } from '../../src/lib/auth-token'

const prisma = new PrismaClient()
const adminUsername = `e2e-admin-${process.pid}`
const adminPassword = 'e2e-only-admin-password'
const limitedUsername = `e2e-warehouse-${process.pid}`
const limitedPassword = 'e2e-only-password'

function sessionCookie(response: APIResponse): string {
  return response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => header.value.split(';')[0])
    .filter((cookie): cookie is string => cookie !== undefined)
    .join('; ')
}

test.beforeAll(async () => {
  await prisma.authSession.deleteMany({
    where: { user: { username: { in: [adminUsername, limitedUsername] } } },
  })
  await prisma.userRole.deleteMany({
    where: { user: { username: { in: [adminUsername, limitedUsername] } } },
  })
  await prisma.user.deleteMany({ where: { username: { in: [adminUsername, limitedUsername] } } })
  await prisma.$transaction([
    prisma.user.create({
      data: {
        username: adminUsername,
        password: await hash(adminPassword, 10),
        roles: { create: { role: 'SUPER_ADMIN' } },
      },
    }),
    prisma.user.create({
      data: {
        username: limitedUsername,
        password: await hash(limitedPassword, 10),
        roles: { create: { role: 'WAREHOUSE_MANAGER' } },
      },
    }),
  ])
})

test.afterAll(async () => {
  await prisma.authSession.deleteMany({
    where: { user: { username: { in: [adminUsername, limitedUsername] } } },
  })
  await prisma.userRole.deleteMany({
    where: { user: { username: { in: [adminUsername, limitedUsername] } } },
  })
  await prisma.user.deleteMany({
    where: { username: { in: [adminUsername, limitedUsername] } },
  })
  await prisma.$disconnect()
})

test('rejects protected APIs and forged session headers without a cookie', async ({ request }) => {
  const protectedResponse = await request.get('/api/users')
  expect(protectedResponse.status()).toBe(401)

  const forgedSession = await request.get('/api/auth/session', {
    headers: {
      'x-user-profile': Buffer.from(
        JSON.stringify({ id: 'attacker', roles: ['SUPER_ADMIN'], isActive: true })
      ).toString('base64'),
    },
  })
  expect(forgedSession.status()).toBe(401)
})

test('allows a super administrator to authenticate and read users', async ({ request }) => {
  const response = await request.post('/api/auth/login', {
    data: {
      identifier: adminUsername,
      password: adminPassword,
    },
  })

  expect(response.ok()).toBe(true)
  const headers = { cookie: sessionCookie(response) }
  const session = await request.get('/api/auth/session', { headers })
  expect(session.ok()).toBe(true)
  const users = await request.get('/api/users', { headers })
  expect(users.ok()).toBe(true)

  const logout = await request.post('/api/auth/logout', { headers })
  expect(logout.ok()).toBe(true)
  const replay = await request.get('/api/users', { headers })
  expect(replay.status()).toBe(401)
})

test('denies user administration to other admin-capable roles', async ({ request }) => {
  const response = await request.post('/api/auth/login', {
    data: { identifier: limitedUsername, password: limitedPassword },
  })
  expect(response.ok()).toBe(true)

  const users = await request.get('/api/users', {
    headers: { cookie: sessionCookie(response) },
  })
  expect(users.status()).toBe(403)
})

test('renews expired access during concurrent page and session requests', async ({
  context,
  page,
}) => {
  const login = await context.request.post('/api/auth/login', {
    data: { identifier: adminUsername, password: adminPassword },
  })
  expect(login.ok()).toBe(true)
  const cookies = await context.cookies()
  const access = cookies.find((cookie) => cookie.name === 'replenops_access_token')!
  const expiry = cookies.find((cookie) => cookie.name === 'replenops_expires_at')!
  const claims = await verifyAuthTokenClaims(access.value, 'access')
  await context.addCookies([
    { ...access, value: await signAuthToken(claims!, 'access', -1) },
    { ...expiry, value: String(Date.now() - 1000) },
  ])
  const [session, , refresh] = await Promise.all([
    context.request.get('/api/auth/session'),
    page.goto('/admin/users'),
    context.request.post('/api/auth/refresh'),
  ])
  expect(session.status()).toBe(200)
  expect(refresh.status()).toBe(200)
  await expect(page).toHaveURL(/\/admin\/users/)
  const renewed = (await context.cookies()).find(
    (cookie) => cookie.name === 'replenops_access_token'
  )!
  expect(await verifyAuthTokenClaims(renewed.value, 'access')).not.toBeNull()
  expect((await context.request.get('/api/users')).status()).toBe(200)
})

test('confirms a business 401 without leaving a valid session or replaying writes', async ({
  context,
  page,
}) => {
  expect(
    (
      await context.request.post('/api/auth/login', {
        data: { identifier: adminUsername, password: adminPassword },
      })
    ).ok()
  ).toBe(true)
  const initialCheck = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/session')
  )
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/admin\/users/)
  await initialCheck
  let calls = 0
  await page.route('**/api/auth-test-write', (route) => {
    calls += 1
    return route.fulfill({ status: 401, json: { error: 'test failure' } })
  })
  const sessionCheck = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/session')
  )
  const status = await page.evaluate(
    async () => (await fetch('/api/auth-test-write', { method: 'POST' })).status
  )
  expect((await sessionCheck).status()).toBe(200)
  expect(status).toBe(401)
  expect(calls).toBe(1)
  await expect(page).toHaveURL(/\/admin\/users/)
})

test('background renewal preserves an open form and still detects revocation', async ({
  context,
  page,
}) => {
  expect(
    (
      await context.request.post('/api/auth/login', {
        data: { identifier: adminUsername, password: adminPassword },
      })
    ).ok()
  ).toBe(true)
  await page.clock.install()
  const initialCheck = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/session')
  )
  await page.goto('/admin/users')
  await initialCheck
  await page.getByRole('button', { name: '新增用户' }).click()
  const draft = page
    .getByRole('dialog', { name: '新增用户' })
    .getByRole('textbox', { name: '登录名' })
  await draft.fill('unsaved-session-draft')

  const cookies = await context.cookies()
  const access = cookies.find((cookie) => cookie.name === 'replenops_access_token')!
  const expiry = cookies.find((cookie) => cookie.name === 'replenops_expires_at')!
  const claims = await verifyAuthTokenClaims(access.value, 'access')
  await context.addCookies([
    { ...access, value: await signAuthToken(claims!, 'access', -1) },
    { ...expiry, value: String(Date.now() - 1000) },
  ])
  const renewal = page.waitForResponse((response) => response.url().endsWith('/api/auth/session'))
  await page.clock.fastForward(4 * 60 * 1000)
  expect((await renewal).status()).toBe(200)
  await expect(draft).toHaveValue('unsaved-session-draft')
  await expect(page).toHaveURL(/\/admin\/users/)

  await prisma.authSession.update({
    where: { id: claims!.sessionId },
    data: { revokedAt: new Date() },
  })
  await page.clock.fastForward(4 * 60 * 1000)
  await expect(page).toHaveURL(/\/login\?redirect=/)
})
