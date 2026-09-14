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

  it.each([
    ['another-product', 'replenops-app'],
    ['replenops', 'another-audience'],
  ])('rejects issuer %s and audience %s independently', async (issuer, audience) => {
    const invalidToken = await new SignJWT({
      ...baseClaims,
      tokenUse: 'access',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(baseClaims.userId)
      .setJti('test-token')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(getJwtSecret())

    await expect(verifyAuthTokenClaims(invalidToken, 'access')).resolves.toBeNull()
  })

  it('accepts a valid access token and rejects an expired one', async () => {
    const valid = await signAuthToken(baseClaims, 'access', 3600, 'valid-token')
    await expect(verifyAuthTokenClaims(valid, 'access')).resolves.toMatchObject({
      ...baseClaims,
      tokenUse: 'access',
      sub: baseClaims.userId,
      jti: 'valid-token',
    })
    const expired = await signAuthToken(baseClaims, 'access', -60)
    await expect(verifyAuthTokenClaims(expired, 'access')).resolves.toBeNull()
  })

  it('rejects a changed payload with the original signature', async () => {
    const token = await signAuthToken(baseClaims, 'access', 3600)
    const [header, encodedPayload, signature] = token.split('.')
    if (!header || !encodedPayload || !signature) throw new Error('Invalid signed token fixture')
    const payload: Record<string, unknown> = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    )
    const tampered = Buffer.from(JSON.stringify({ ...payload, username: 'forged' })).toString(
      'base64url'
    )
    await expect(
      verifyAuthTokenClaims(`${header}.${tampered}.${signature}`, 'access')
    ).resolves.toBeNull()
  })

  it('rejects a correctly signed token using an unapproved algorithm', async () => {
    const token = await new SignJWT({ ...baseClaims, tokenUse: 'access' })
      .setProtectedHeader({ alg: 'HS384' })
      .setIssuer('replenops')
      .setAudience('replenops-app')
      .setSubject(baseClaims.userId)
      .setJti('wrong-algorithm')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(getJwtSecret())
    await expect(verifyAuthTokenClaims(token, 'access')).resolves.toBeNull()
  })
})
