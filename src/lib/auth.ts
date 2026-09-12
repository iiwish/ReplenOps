import { createHash, createHmac, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { getJwtSecret } from './jwt-secret'
import {
  signAuthToken,
  verifyAuthTokenClaims,
  type AuthTokenClaims,
  type AuthTokenSubject,
} from './auth-token'

export interface AuthUser {
  id: string
  username: string
  name: string | null
  email: string | null
  phone: string | null
  avatar: string | null
  isActive: boolean
  roles: string[]
  displayName?: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope: string
}

export interface AuthResult {
  success: boolean
  user?: AuthUser
  tokens?: TokenResponse
  error?: string
}

type ActiveUserRecord = Prisma.UserGetPayload<{ include: { roles: true } }>
type AuthSessionRecord = Prisma.AuthSessionGetPayload<{
  include: { user: { include: { roles: true } } }
}>

function hashRefreshTokenId(tokenId: string): string {
  return createHash('sha256').update(tokenId).digest('hex')
}

const REFRESH_GRACE_MS = 30_000

function nextRefreshTokenId(tokenId: string): string {
  return createHmac('sha256', getJwtSecret()).update(`refresh-rotation:${tokenId}`).digest('hex')
}

export class LocalAuth {
  private readonly accessTokenExpiry = 60 * 60
  private readonly refreshTokenExpiry = 7 * 24 * 60 * 60

  private toAuthUser(user: ActiveUserRecord): AuthUser {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      isActive: user.isActive,
      roles: user.roles.map((role) => role.role),
    }
  }

  private sessionMatchesClaims(session: AuthSessionRecord, claims: AuthTokenClaims): boolean {
    return (
      session.id === claims.sessionId &&
      session.user.id === claims.userId &&
      session.user.username === claims.username &&
      session.user.sessionVersion === claims.sessionVersion &&
      session.user.isActive &&
      !session.user.isDeleted &&
      !session.revokedAt &&
      session.expiresAt > new Date()
    )
  }

  private async findSession(sessionId: string): Promise<AuthSessionRecord | null> {
    return prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: { include: { roles: true } } },
    })
  }

  private async issueTokens(
    user: AuthUser,
    sessionVersion: number,
    sessionId: string,
    refreshTokenId: string,
    refreshExpiresIn = this.refreshTokenExpiry
  ): Promise<TokenResponse> {
    const subject: AuthTokenSubject = {
      userId: user.id,
      username: user.username,
      sessionVersion,
      sessionId,
    }
    const [accessToken, refreshToken] = await Promise.all([
      signAuthToken(subject, 'access', this.accessTokenExpiry),
      signAuthToken(subject, 'refresh', refreshExpiresIn, refreshTokenId),
    ])

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.accessTokenExpiry,
      refresh_token: refreshToken,
      scope: 'read',
    }
  }

  async verifyCredentials(identifier: string, password: string): Promise<AuthResult> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ username: identifier }, { phone: identifier }],
          isActive: true,
          isDeleted: false,
        },
        include: { roles: true },
      })

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return { success: false, error: '用户名或密码错误' }
      }

      const authUser = this.toAuthUser(user)
      const tokens = await this.generateTokens(authUser, user.sessionVersion)

      return { success: true, user: authUser, tokens }
    } catch (error) {
      console.error('Failed to verify credentials:', error)
      return { success: false, error: '认证失败' }
    }
  }

  async generateTokens(
    user: AuthUser,
    sessionVersion: number,
    tx?: Prisma.TransactionClient
  ): Promise<TokenResponse> {
    const sessionId = randomUUID()
    const refreshTokenId = randomUUID()
    const expiresAt = new Date(Date.now() + this.refreshTokenExpiry * 1000)

    const createSession = async (client: Prisma.TransactionClient) => {
      await client.authSession.deleteMany({
        where: {
          userId: user.id,
          OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
        },
      })
      await client.authSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          refreshTokenHash: hashRefreshTokenId(refreshTokenId),
          expiresAt,
        },
      })
    }
    if (tx) await createSession(tx)
    else await prisma.$transaction(createSession)

    return this.issueTokens(user, sessionVersion, sessionId, refreshTokenId)
  }

  async verifyAccessToken(token: string): Promise<AuthUser | null> {
    const claims = await verifyAuthTokenClaims(token, 'access')
    if (!claims) return null

    const session = await this.findSession(claims.sessionId)
    if (!session || !this.sessionMatchesClaims(session, claims)) return null

    return this.toAuthUser(session.user)
  }

  async verifyRefreshToken(token: string): Promise<TokenResponse | null> {
    const claims = await verifyAuthTokenClaims(token, 'refresh')
    if (!claims) return null

    return prisma.$transaction(async (tx) => {
      // Serialize rotation across processes, not just requests in one JS runtime.
      await tx.$queryRaw`SELECT "id" FROM "auth_sessions" WHERE "id" = ${claims.sessionId} FOR UPDATE`
      const session = await tx.authSession.findUnique({
        where: { id: claims.sessionId },
        include: { user: { include: { roles: true } } },
      })
      if (!session || !this.sessionMatchesClaims(session, claims)) return null

      const now = Date.now()
      const withinGrace =
        session.refreshRotatedAt !== null &&
        now - session.refreshRotatedAt.getTime() < REFRESH_GRACE_MS
      const presentedHash = hashRefreshTokenId(claims.jti)
      let tokenId = claims.jti

      if (presentedHash !== session.refreshTokenHash) {
        tokenId = nextRefreshTokenId(claims.jti)
        if (
          !withinGrace ||
          presentedHash !== session.previousRefreshTokenHash ||
          hashRefreshTokenId(tokenId) !== session.refreshTokenHash
        ) {
          await tx.authSession.update({
            where: { id: session.id },
            data: { revokedAt: new Date() },
          })
          return null
        }
      } else if (!withinGrace) {
        tokenId = nextRefreshTokenId(claims.jti)
        await tx.authSession.update({
          where: { id: session.id },
          data: {
            previousRefreshTokenHash: session.refreshTokenHash,
            refreshTokenHash: hashRefreshTokenId(tokenId),
            refreshRotatedAt: new Date(now),
          },
        })
      }

      // Reuse the same generation during grace so out-of-order responses remain usable.
      const refreshExpiresIn = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000)
      if (refreshExpiresIn <= 0) return null
      return this.issueTokens(
        this.toAuthUser(session.user),
        session.user.sessionVersion,
        session.id,
        tokenId,
        refreshExpiresIn
      )
    })
  }

  async revokeToken(token: string): Promise<void> {
    const claims =
      (await verifyAuthTokenClaims(token, 'access')) ??
      (await verifyAuthTokenClaims(token, 'refresh'))

    if (!claims) return

    await prisma.authSession.updateMany({
      where: {
        id: claims.sessionId,
        userId: claims.userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    })
  }
}

export const localAuth = new LocalAuth()
