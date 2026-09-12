import { afterEach, describe, expect, it } from 'vitest'
import { hash } from 'bcryptjs'
import { LocalAuth, localAuth } from '@/lib/auth'
import { verifyAuthTokenClaims } from '@/lib/auth-token'
import { prisma } from '@/lib/prisma'
import { userService } from '@/services/user.service'

const username = `auth-security-${process.pid}`
const operatedBy = `auth-security-operator-${process.pid}`

describe('database-backed auth session revocation', () => {
  afterEach(async () => {
    await prisma.approvalLog.deleteMany({ where: { operatedBy } })
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
    const claims = await verifyAuthTokenClaims(refreshToken!, 'refresh')
    await prisma.authSession.update({
      where: { id: claims!.sessionId },
      data: { refreshRotatedAt: new Date(Date.now() - 31_000) },
    })
    await expect(localAuth.verifyRefreshToken(refreshToken!)).resolves.toBeNull()
    await expect(localAuth.verifyRefreshToken(rotated?.refresh_token ?? '')).resolves.toBeNull()

    await userService.update(user.id, {}, ['STORE_ADMIN'], undefined, operatedBy)

    await expect(localAuth.verifyAccessToken(accessToken!)).resolves.toBeNull()
    await expect(localAuth.verifyRefreshToken(refreshToken!)).resolves.toBeNull()
  })

  it('shares a rotation across independent instances without revoking the session', async () => {
    await prisma.user.create({
      data: {
        username,
        password: await hash('test-only-password', 10),
        roles: { create: { role: 'STORE_ADMIN' } },
      },
    })
    const login = await localAuth.verifyCredentials(username, 'test-only-password')
    const refresh = login.tokens!.refresh_token!
    const originalClaims = await verifyAuthTokenClaims(refresh, 'refresh')
    const originalSession = await prisma.authSession.findUniqueOrThrow({
      where: { id: originalClaims!.sessionId },
    })
    const results = await Promise.all(
      Array.from({ length: 6 }, () => new LocalAuth().verifyRefreshToken(refresh))
    )
    expect(results.every(Boolean)).toBe(true)
    const claims = await Promise.all(
      results.map((result) => verifyAuthTokenClaims(result!.refresh_token!, 'refresh'))
    )
    expect(new Set(claims.map((claim) => claim!.jti)).size).toBe(1)
    const again = await new LocalAuth().verifyRefreshToken(results[0]!.refresh_token!)
    expect((await verifyAuthTokenClaims(again!.refresh_token!, 'refresh'))!.jti).toBe(
      claims[0]!.jti
    )
    await expect(localAuth.verifyAccessToken(results[0]!.access_token)).resolves.not.toBeNull()
    const after = await prisma.authSession.findUniqueOrThrow({
      where: { id: originalClaims!.sessionId },
    })
    expect(after.expiresAt).toEqual(originalSession.expiresAt)
    expect(after.revokedAt).toBeNull()
    await localAuth.revokeToken(results[0]!.access_token)
    await expect(new LocalAuth().verifyRefreshToken(refresh)).resolves.toBeNull()
  })

  it.each(['expired', 'disabled', 'role-change'] as const)(
    'does not renew a %s session',
    async (reason) => {
      const user = await prisma.user.create({
        data: {
          username,
          password: await hash('test-only-password', 10),
          roles: { create: { role: 'STORE_ADMIN' } },
        },
      })
      const login = await localAuth.verifyCredentials(username, 'test-only-password')
      const refresh = login.tokens!.refresh_token!
      const rotated = await localAuth.verifyRefreshToken(refresh)
      if (reason === 'expired') {
        await prisma.authSession.updateMany({
          where: { userId: user.id },
          data: { expiresAt: new Date(Date.now() - 1000) },
        })
      } else if (reason === 'disabled') {
        await prisma.user.update({ where: { id: user.id }, data: { isActive: false } })
      } else {
        await userService.update(user.id, {}, ['WAREHOUSE_MANAGER'], undefined, operatedBy)
      }
      await expect(localAuth.verifyAccessToken(rotated!.access_token)).resolves.toBeNull()
      await expect(localAuth.verifyRefreshToken(refresh)).resolves.toBeNull()
      await expect(localAuth.verifyRefreshToken(rotated!.refresh_token!)).resolves.toBeNull()
    }
  )

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
