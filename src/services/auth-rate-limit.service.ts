import { createHmac } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getJwtSecret } from '@/lib/jwt-secret'

const WINDOW_MS = 15 * 60 * 1000
const BLOCK_MS = 15 * 60 * 1000
const MAX_FAILURES = 5
const CLEANUP_AGE_MS = 24 * 60 * 60 * 1000

export interface RateLimitDecision {
  allowed: boolean
  retryAfterSeconds?: number
}

function retryAfterSeconds(blockedUntil: Date, now: Date): number {
  return Math.max(1, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000))
}

export function getLoginClientAddress(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwardedFor || headers.get('x-real-ip')?.trim() || 'unknown'
}

export function createLoginRateLimitKey(identifier: string, clientAddress: string): string {
  const normalizedIdentifier = identifier.normalize('NFKC').trim().toLowerCase()
  const normalizedAddress = clientAddress.trim().toLowerCase()

  return createHmac('sha256', getJwtSecret())
    .update(`${normalizedIdentifier}\u0000${normalizedAddress}`)
    .digest('hex')
}

export class AuthRateLimitService {
  async check(key: string, now = new Date()): Promise<RateLimitDecision> {
    const record = await prisma.loginRateLimit.findUnique({ where: { key } })

    if (record?.blockedUntil && record.blockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: retryAfterSeconds(record.blockedUntil, now),
      }
    }

    return { allowed: true }
  }

  async recordFailure(key: string, now = new Date()): Promise<RateLimitDecision> {
    const run = async () =>
      prisma.$transaction(
        async (tx) => {
          const existing = await tx.loginRateLimit.findUnique({ where: { key } })

          if (existing?.blockedUntil && existing.blockedUntil > now) {
            return {
              allowed: false,
              retryAfterSeconds: retryAfterSeconds(existing.blockedUntil, now),
            }
          }

          const windowExpired =
            !existing || now.getTime() - existing.windowStartedAt.getTime() >= WINDOW_MS
          const failures = windowExpired ? 1 : existing.failures + 1
          const blockedUntil = failures >= MAX_FAILURES ? new Date(now.getTime() + BLOCK_MS) : null

          await tx.loginRateLimit.upsert({
            where: { key },
            create: {
              key,
              failures,
              windowStartedAt: now,
              blockedUntil,
            },
            update: {
              failures,
              windowStartedAt: windowExpired ? now : existing.windowStartedAt,
              blockedUntil,
            },
          })

          return blockedUntil
            ? {
                allowed: false,
                retryAfterSeconds: retryAfterSeconds(blockedUntil, now),
              }
            : { allowed: true }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await run()
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') {
          throw error
        }
      }
    }

    throw new Error('Unable to record login rate limit after retrying')
  }

  async clear(key: string, now = new Date()): Promise<void> {
    await prisma.loginRateLimit.deleteMany({
      where: {
        OR: [{ key }, { updatedAt: { lt: new Date(now.getTime() - CLEANUP_AGE_MS) } }],
      },
    })
  }
}

export const authRateLimitService = new AuthRateLimitService()
