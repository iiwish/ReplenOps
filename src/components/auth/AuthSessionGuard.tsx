'use client'

import { useEffect } from 'react'
import {
  endClientSession,
  isProtectedPath,
  isSessionEndedStorageEvent,
  redirectToLogin,
} from '@/lib/auth-client'

const SESSION_CHECK_INTERVAL_MS = 4 * 60 * 1000
const FOCUS_CHECK_INTERVAL_MS = 60 * 1000
const SESSION_LOCK_NAME = 'replenops-session-check'

function isSameOriginRequest(input: RequestInfo | URL): boolean {
  const url =
    input instanceof Request
      ? new URL(input.url)
      : new URL(typeof input === 'string' ? input : input.toString(), window.location.href)

  return url.origin === window.location.origin
}

export function AuthSessionGuard() {
  useEffect(() => {
    if (!isProtectedPath(window.location.pathname)) return

    const originalFetch = window.fetch.bind(window)
    let lastCheckedAt = 0
    let redirecting = false

    const handleSessionEnded = () => {
      if (redirecting) return
      redirecting = true
      endClientSession()
    }

    window.fetch = async (...args) => {
      const response = await originalFetch(...args)

      if (response.status === 401 && isSameOriginRequest(args[0])) {
        handleSessionEnded()
      }

      return response
    }

    const requestSession = async () => {
      const response = await originalFetch('/api/auth/session', {
        cache: 'no-store',
        credentials: 'same-origin',
      })

      lastCheckedAt = Date.now()
      if (response.status === 401) handleSessionEnded()
    }

    const checkSession = async () => {
      if (redirecting || document.visibilityState === 'hidden') return

      try {
        if (navigator.locks) {
          await navigator.locks.request(SESSION_LOCK_NAME, requestSession)
        } else {
          await requestSession()
        }
      } catch (error) {
        console.error('会话状态检查失败:', error)
      }
    }

    const checkAfterInactivity = () => {
      if (Date.now() - lastCheckedAt >= FOCUS_CHECK_INTERVAL_MS) {
        void checkSession()
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (!isSessionEndedStorageEvent(event)) return
      redirecting = true
      redirectToLogin()
    }

    void checkSession()
    const intervalId = window.setInterval(() => void checkSession(), SESSION_CHECK_INTERVAL_MS)
    window.addEventListener('focus', checkAfterInactivity)
    window.addEventListener('storage', handleStorage)
    document.addEventListener('visibilitychange', checkAfterInactivity)

    return () => {
      window.fetch = originalFetch
      window.clearInterval(intervalId)
      window.removeEventListener('focus', checkAfterInactivity)
      window.removeEventListener('storage', handleStorage)
      document.removeEventListener('visibilitychange', checkAfterInactivity)
    }
  }, [])

  return null
}
