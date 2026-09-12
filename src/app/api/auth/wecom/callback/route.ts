import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { completeWecom, getWecomAuthOrigin } from '@/services/wecom-auth.service'
import { getCurrentUser, setSession } from '@/lib/session'
import { BROWSER_COOKIE, FLOW_COOKIE, flowCookieOptions, validToken } from '@/lib/wecom/security'
import {
  cancelCurrentWecomFlow,
  clearWecomCookies,
  privateResponse,
  resumeWecomAutoLogin,
} from '@/lib/wecom/http'

export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.origin !== (await getWecomAuthOrigin())) throw new Error('Wrong origin')
    if (await getCurrentUser()) {
      await cancelCurrentWecomFlow()
      return privateResponse(NextResponse.redirect(new URL('/', request.url)))
    }
    const jar = await cookies()
    const state = request.nextUrl.searchParams.get('state') ?? ''
    const browser = jar.get(BROWSER_COOKIE)?.value
    const code = z.string().min(1).max(512).parse(request.nextUrl.searchParams.get('code'))
    if (!validToken(state) || !validToken(browser) || state !== jar.get(FLOW_COOKIE)?.value)
      throw new Error('Invalid state')
    const result = await completeWecom(state, browser, code, request.nextUrl.origin)
    if (result.kind === 'bind') {
      jar.set(FLOW_COOKIE, result.token, flowCookieOptions)
      jar.set(BROWSER_COOKIE, browser, flowCookieOptions)
      return privateResponse(NextResponse.redirect(new URL('/login/wecom-bind', request.url)))
    }
    await setSession(
      result.tokens.access_token,
      result.tokens.refresh_token,
      result.tokens.expires_in
    )
    await clearWecomCookies()
    await resumeWecomAutoLogin()
    return privateResponse(NextResponse.redirect(new URL(result.returnPath, request.url)))
  } catch {
    await clearWecomCookies()
    return privateResponse(
      NextResponse.redirect(new URL('/login?wecomError=1&local=1', request.url))
    )
  }
}
