import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'
import type { APIResponse } from '@playwright/test'

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
