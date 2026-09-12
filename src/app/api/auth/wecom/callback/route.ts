import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { completeWecom, getWecomAuthOrigin } from '@/services/wecom-auth.service'
import { getCurrentUser, setSession } from '@/lib/session'
import { BROWSER_COOKIE, FLOW_COOKIE, flowCookieOptions, validToken } from '@/lib/wecom/security'
import {
  cancelCurrentWecomFlow,
  clearWecomCookies,
  requestOrigin,
  localRedirect,
  resumeWecomAutoLogin,
} from '@/lib/wecom/http'

export async function GET(request: NextRequest) {
  try {
    if (requestOrigin(request) !== (await getWecomAuthOrigin())) throw new Error('Wrong origin')
    if (await getCurrentUser()) {
      await cancelCurrentWecomFlow()
      return localRedirect('/')
    }
    const jar = await cookies()
    const state = request.nextUrl.searchParams.get('state') ?? ''
    const browser = jar.get(BROWSER_COOKIE)?.value
    const code = z.string().min(1).max(512).parse(request.nextUrl.searchParams.get('code'))
    if (!validToken(state) || !validToken(browser) || state !== jar.get(FLOW_COOKIE)?.value)
      throw new Error('Invalid state')
    const result = await completeWecom(state, browser, code, requestOrigin(request))
    if (result.kind === 'bind') {
      jar.set(FLOW_COOKIE, result.token, flowCookieOptions)
      jar.set(BROWSER_COOKIE, browser, flowCookieOptions)
      return localRedirect('/login/wecom-bind')
    }
    await setSession(
      result.tokens.access_token,
      result.tokens.refresh_token,
      result.tokens.expires_in
    )
    await clearWecomCookies()
    await resumeWecomAutoLogin()
    return localRedirect(result.returnPath)
  } catch {
    await clearWecomCookies()
    return localRedirect('/login?wecomError=1&local=1')
  }
}
