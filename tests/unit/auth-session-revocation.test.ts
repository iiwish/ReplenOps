import { afterEach, describe, expect, it } from 'vitest'
import { hash } from 'bcryptjs'
import { localAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { userService } from '@/services/user.service'

const username = `auth-security-${process.pid}`

describe('database-backed auth session revocation', () => {
  afterEach(async () => {
    await prisma.userRole.deleteMany({ where: { user: { username } } })
    await prisma.user.deleteMany({ where: { username } })
  })

  it('rotates refresh tokens and invalidates old claims after a role change', async () => {
    const user = await prisma.user.create({
      data: {
        username,
        password: await hash('test-only-password', 10),
        roles: { create: { role: 'WAREHOUSE_MANAGER' } },
      },
    })
    const authenticated = await localAuth.verifyCredentials(username, 'test-only-password')
    const accessToken = authenticated.tokens?.access_token
    const refreshToken = authenticated.tokens?.refresh_token

    expect(accessToken).toBeDefined()
    expect(refreshToken).toBeDefined()
    expect((await localAuth.verifyAccessToken(accessToken!))?.roles).toEqual(['WAREHOUSE_MANAGER'])

    const rotated = await localAuth.verifyRefreshToken(refreshToken!)
    expect(rotated?.access_token).not.toBe(accessToken)
    expect(rotated?.refresh_token).not.toBe(refreshToken)
    await expect(localAuth.verifyRefreshToken(refreshToken!)).resolves.toBeNull()
    await expect(localAuth.verifyRefreshToken(rotated?.refresh_token ?? '')).resolves.toBeNull()

    await userService.update(user.id, {}, ['STORE_ADMIN'])

    await expect(localAuth.verifyAccessToken(accessToken!)).resolves.toBeNull()
    await expect(localAuth.verifyRefreshToken(refreshToken!)).resolves.toBeNull()
  })

  it('revokes the current token version on logout', async () => {
    await prisma.user.create({
      data: {
        username,
        password: await hash('test-only-password', 10),
        roles: { create: { role: 'STORE_ADMIN' } },
      },
    })
    const authenticated = await localAuth.verifyCredentials(username, 'test-only-password')
    const accessToken = authenticated.tokens?.access_token

    expect(accessToken).toBeDefined()
    await localAuth.revokeToken(accessToken!)
    await expect(localAuth.verifyAccessToken(accessToken!)).resolves.toBeNull()
  })
})
