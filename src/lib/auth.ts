import { createHash, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
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

  async generateTokens(user: AuthUser, sessionVersion: number): Promise<TokenResponse> {
    const sessionId = randomUUID()
    const refreshTokenId = randomUUID()
    const expiresAt = new Date(Date.now() + this.refreshTokenExpiry * 1000)

    await prisma.$transaction([
      prisma.authSession.deleteMany({
        where: {
          userId: user.id,
          OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
        },
      }),
      prisma.authSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          refreshTokenHash: hashRefreshTokenId(refreshTokenId),
          expiresAt,
        },
      }),
    ])

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

    const session = await this.findSession(claims.sessionId)
    if (!session || !this.sessionMatchesClaims(session, claims)) return null
    if (session.refreshTokenHash !== hashRefreshTokenId(claims.jti)) {
      await prisma.authSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      return null
    }

    const nextRefreshTokenId = randomUUID()
    const rotated = await prisma.authSession.updateMany({
      where: {
        id: session.id,
        refreshTokenHash: session.refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { refreshTokenHash: hashRefreshTokenId(nextRefreshTokenId) },
    })

    if (rotated.count !== 1) return null

    const refreshExpiresIn = Math.max(
      1,
      Math.floor((session.expiresAt.getTime() - Date.now()) / 1000)
    )
    return this.issueTokens(
      this.toAuthUser(session.user),
      session.user.sessionVersion,
      session.id,
      nextRefreshTokenId,
      refreshExpiresIn
    )
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
