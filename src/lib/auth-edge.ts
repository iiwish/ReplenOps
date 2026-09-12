import { localAuth, type AuthUser, type TokenResponse } from './auth'

export function verifyToken(token: string): Promise<AuthUser | null> {
  return localAuth.verifyAccessToken(token)
}

export function refreshAccessToken(token: string): Promise<TokenResponse | null> {
  return localAuth.verifyRefreshToken(token)
}
