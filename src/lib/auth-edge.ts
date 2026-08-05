import { jwtVerify } from 'jose'
import type { AuthUser } from './auth'
import { getJwtSecret } from './jwt-secret'

const JWT_ALGORITHM = 'HS256'

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: [JWT_ALGORITHM],
    })

    const tokenPayload = payload as unknown as {
      userId: string
      username: string
      roles: string[]
    }

    return {
      id: tokenPayload.userId,
      username: tokenPayload.username,
      name: null,
      email: null,
      phone: null,
      avatar: null,
      isActive: true,
      roles: tokenPayload.roles,
      displayName: tokenPayload.username,
    }
  } catch (error) {
    console.error('Failed to verify token:', error)
    return null
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
} | null> {
  try {
    const jwtSecret = getJwtSecret()
    const { payload } = await jwtVerify(refreshToken, jwtSecret, {
      algorithms: [JWT_ALGORITHM],
    })

    const tokenPayload = payload as unknown as {
      userId: string
      username: string
      roles: string[]
    }

    const now = Math.floor(Date.now() / 1000)
    const accessTokenExpiry = 60 * 60

    const accessTokenPayload = {
      userId: tokenPayload.userId,
      username: tokenPayload.username,
      roles: tokenPayload.roles,
      exp: now + accessTokenExpiry,
      iat: now,
    }

    const { SignJWT } = await import('jose')

    const newAccessToken = await new SignJWT(accessTokenPayload)
      .setProtectedHeader({ alg: JWT_ALGORITHM })
      .sign(jwtSecret)

    return {
      access_token: newAccessToken,
      refresh_token: refreshToken,
      expires_in: accessTokenExpiry,
    }
  } catch (error) {
    console.error('Failed to refresh access token:', error)
    return null
  }
}
