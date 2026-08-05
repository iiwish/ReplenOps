import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { authRateLimitService, createLoginRateLimitKey } from '@/services/auth-rate-limit.service'

const originalJwtSecret = process.env.JWT_SECRET
const identifier = `rate-limit-user-${process.pid}`
const clientAddress = '203.0.113.9'
let key = ''

describe('database-backed login rate limiting', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-only-jwt-secret-with-32-characters'
    key = createLoginRateLimitKey(identifier, clientAddress)
  })

  afterEach(async () => {
    await prisma.loginRateLimit.deleteMany({ where: { key } })
  })

  afterAll(() => {
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET
      return
    }
    process.env.JWT_SECRET = originalJwtSecret
  })

  it('stores only an opaque keyed hash and blocks the fifth failure', async () => {
    expect(key).not.toContain(identifier)
    expect(key).not.toContain(clientAddress)
    expect(key).toMatch(/^[a-f0-9]{64}$/)

    for (let attempt = 1; attempt < 5; attempt += 1) {
      await expect(authRateLimitService.recordFailure(key)).resolves.toEqual({ allowed: true })
    }

    const blocked = await authRateLimitService.recordFailure(key)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
    await expect(authRateLimitService.check(key)).resolves.toMatchObject({ allowed: false })

    const stored = await prisma.loginRateLimit.findUniqueOrThrow({ where: { key } })
    expect(stored.key).toBe(key)
  })

  it('clears the current counter after a successful login', async () => {
    await authRateLimitService.recordFailure(key)
    await authRateLimitService.clear(key)

    await expect(authRateLimitService.check(key)).resolves.toEqual({ allowed: true })
    await expect(prisma.loginRateLimit.findUnique({ where: { key } })).resolves.toBeNull()
  })
})
