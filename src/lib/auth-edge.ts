import { localAuth, type AuthUser, type TokenResponse } from './auth'

const REFRESH_DEDUPLICATION_MS = 5_000
const pendingRefreshes = new Map<
  string,
  { expiresAt: number; promise: Promise<TokenResponse | null> }
>()

export function verifyToken(token: string): Promise<AuthUser | null> {
  return localAuth.verifyAccessToken(token)
}

export function refreshAccessToken(token: string): Promise<TokenResponse | null> {
  const now = Date.now()
  const pending = pendingRefreshes.get(token)

  if (pending && pending.expiresAt > now) {
    return pending.promise
  }

  const promise = localAuth.verifyRefreshToken(token)
  const entry = { expiresAt: Number.POSITIVE_INFINITY, promise }
  pendingRefreshes.set(token, entry)

  const scheduleCleanup = () => {
    entry.expiresAt = Date.now() + REFRESH_DEDUPLICATION_MS
    setTimeout(() => {
      if (pendingRefreshes.get(token)?.promise === promise) {
        pendingRefreshes.delete(token)
      }
    }, REFRESH_DEDUPLICATION_MS)
  }

  void promise.then(scheduleCleanup, scheduleCleanup)

  return promise
}
