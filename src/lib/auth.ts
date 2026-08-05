import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { getJwtSecret } from './jwt-secret'

const JWT_ALGORITHM = 'HS256'

export interface TokenPayload {
  userId: string
  username: string
  roles: string[]
  exp?: number
  iat?: number
  [key: string]: unknown
}

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

export class LocalAuth {
  private accessTokenExpiry = 60 * 60
  private refreshTokenExpiry = 7 * 24 * 60 * 60

  async verifyCredentials(identifier: string, password: string): Promise<AuthResult> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ username: identifier }, { phone: identifier }],
          isActive: true,
          isDeleted: false,
        },
        include: {
          roles: true,
        },
      })

      if (!user) {
        return { success: false, error: '用户名或密码错误' }
      }

      const isValidPassword = await bcrypt.compare(password, user.password)

      if (!isValidPassword) {
        return { success: false, error: '用户名或密码错误' }
      }

      const roles = user.roles.map((r) => r.role)

      const authUser: AuthUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        isActive: user.isActive,
        roles,
      }

      const tokens = await this.generateTokens(authUser)

      return { success: true, user: authUser, tokens }
    } catch (error) {
      console.error('Failed to verify credentials:', error)
      return { success: false, error: '认证失败' }
    }
  }

  async generateTokens(user: AuthUser): Promise<TokenResponse> {
    const now = Math.floor(Date.now() / 1000)
    const jwtSecret = getJwtSecret()

    const accessTokenPayload: TokenPayload = {
      userId: user.id,
      username: user.username,
      roles: user.roles,
      exp: now + this.accessTokenExpiry,
      iat: now,
    }

    const refreshTokenPayload: TokenPayload = {
      userId: user.id,
      username: user.username,
      roles: user.roles,
      exp: now + this.refreshTokenExpiry,
      iat: now,
    }

    const accessToken = await new SignJWT(accessTokenPayload)
      .setProtectedHeader({ alg: JWT_ALGORITHM })
      .sign(jwtSecret)

    const refreshToken = await new SignJWT(refreshTokenPayload)
      .setProtectedHeader({ alg: JWT_ALGORITHM })
      .sign(jwtSecret)

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.accessTokenExpiry,
      refresh_token: refreshToken,
      scope: 'read',
    }
  }

  async verifyAccessToken(token: string): Promise<AuthUser | null> {
    try {
      const { payload } = await jwtVerify(token, getJwtSecret(), {
        algorithms: [JWT_ALGORITHM],
      })

      const tokenPayload = payload as unknown as TokenPayload

      const user = await prisma.user.findUnique({
        where: { id: tokenPayload.userId },
        include: {
          roles: true,
        },
      })

      if (!user || !user.isActive || user.isDeleted) {
        return null
      }

      const roles = user.roles.map((r) => r.role)

      return {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        isActive: user.isActive,
        roles,
      }
    } catch (error) {
      console.error('Failed to verify access token:', error)
      return null
    }
  }

  async verifyRefreshToken(token: string): Promise<TokenResponse | null> {
    try {
      const { payload } = await jwtVerify(token, getJwtSecret(), {
        algorithms: [JWT_ALGORITHM],
      })

      const tokenPayload = payload as unknown as TokenPayload

      const user = await prisma.user.findUnique({
        where: { id: tokenPayload.userId },
        include: {
          roles: true,
        },
      })

      if (!user || !user.isActive || user.isDeleted) {
        return null
      }

      const roles = user.roles.map((r) => r.role)

      const authUser: AuthUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        isActive: user.isActive,
        roles,
      }

      return await this.generateTokens(authUser)
    } catch (error) {
      console.error('Failed to verify refresh token:', error)
      return null
    }
  }
}

export const localAuth = new LocalAuth()
