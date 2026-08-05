import { SignJWT } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getJwtSecret } from '@/lib/jwt-secret'
import { signAuthToken, verifyAuthTokenClaims } from '@/lib/auth-token'

const baseClaims = {
  userId: 'user-1',
  username: 'admin',
  sessionVersion: 3,
  sessionId: 'session-1',
}

const originalJwtSecret = process.env.JWT_SECRET

beforeAll(() => {
  process.env.JWT_SECRET = 'test-only-jwt-secret-with-32-characters'
})

afterAll(() => {
  if (originalJwtSecret === undefined) {
    delete process.env.JWT_SECRET
    return
  }
  process.env.JWT_SECRET = originalJwtSecret
})

describe('auth token security boundary', () => {
  it('does not accept a refresh token as an access token', async () => {
    const refreshToken = await signAuthToken(baseClaims, 'refresh', 3600)

    await expect(verifyAuthTokenClaims(refreshToken, 'access')).resolves.toBeNull()
    await expect(verifyAuthTokenClaims(refreshToken, 'refresh')).resolves.toMatchObject({
      ...baseClaims,
      tokenUse: 'refresh',
    })
  })

  it('rejects tokens with an unexpected issuer or audience', async () => {
    const invalidToken = await new SignJWT({
      ...baseClaims,
      tokenUse: 'access',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('another-product')
      .setAudience('another-audience')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(getJwtSecret())

    await expect(verifyAuthTokenClaims(invalidToken, 'access')).resolves.toBeNull()
  })
})
