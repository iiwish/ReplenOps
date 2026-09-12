import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { beginWecom, getWecomAuthOrigin } from '@/services/wecom-auth.service'
import {
  authRateLimitService,
  createLoginRateLimitKey,
  getLoginClientAddress,
} from '@/services/auth-rate-limit.service'
import {
  BROWSER_COOKIE,
  FLOW_COOKIE,
  flowCookieOptions,
  randomToken,
  safeReturnPath,
  validToken,
} from '@/lib/wecom/security'
import {
  pauseWecomAutoLogin,
  privateResponse,
  requestOrigin,
  localRedirect,
} from '@/lib/wecom/http'

export async function GET(request: NextRequest) {
  try {
    const returnPath = safeReturnPath(request.nextUrl.searchParams.get('redirect'))
    if (await getCurrentUser()) return localRedirect(returnPath)
    const origin = await getWecomAuthOrigin()
    if (requestOrigin(request) !== origin) {
      const canonical = new URL('/api/auth/wecom/start', origin)
      canonical.searchParams.set('redirect', returnPath)
      return privateResponse(NextResponse.redirect(canonical))
    }
    const jar = await cookies()
    const existing = jar.get(BROWSER_COOKIE)?.value
    const browser = validToken(existing) ? existing : randomToken()
    // Employees behind one store's NAT must not share a five-attempt login quota.
    const key = createLoginRateLimitKey(
      `wecom:start:${browser}`,
      getLoginClientAddress(request.headers)
    )
    const limit = await authRateLimitService.recordFailure(key)
    if (!limit.allowed) throw new Error('Rate limited')
    const flow = await beginWecom(
      returnPath,
      browser,
      requestOrigin(request),
      jar.get(FLOW_COOKIE)?.value
    )
    jar.set(BROWSER_COOKIE, browser, flowCookieOptions)
    jar.set(FLOW_COOKIE, flow.state, flowCookieOptions)
    await pauseWecomAutoLogin()
    return privateResponse(NextResponse.redirect(flow.url))
  } catch {
    await pauseWecomAutoLogin()
    return localRedirect('/login?wecomError=1&local=1')
  }
}
