import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeAuthOrigin } from './origin'
import { createDomainRoutingConfig, getCookieDomain } from '@/lib/domain-routing'
import { cancelWecomFlow } from '@/services/wecom-auth.service'
import { BROWSER_COOKIE, FLOW_COOKIE, PAUSE_COOKIE, flowCookieOptions } from './security'

export function privateResponse(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

export function requestOrigin(request: NextRequest) {
  // Next's internal URL may contain the container port; the proxy preserves Host.
  return normalizeAuthOrigin(
    `${request.nextUrl.protocol}//${request.headers.get('host') || request.nextUrl.host}`,
    process.env.NODE_ENV !== 'production'
  )
}

export function localRedirect(path: string) {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\'))
    throw new Error('Invalid local redirect')
  return privateResponse(new NextResponse(null, { status: 307, headers: { Location: path } }))
}

export async function clearWecomCookies() {
  const jar = await cookies()
  jar.set(FLOW_COOKIE, '', { ...flowCookieOptions, maxAge: 0 })
  jar.set(BROWSER_COOKIE, '', { ...flowCookieOptions, maxAge: 0 })
}

export async function pauseWecomAutoLogin() {
  const jar = await cookies()
  const domain = getCookieDomain(createDomainRoutingConfig())
  jar.set(PAUSE_COOKIE, '1', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    ...(domain ? { domain } : {}),
  })
}

export async function resumeWecomAutoLogin() {
  const jar = await cookies()
  const domain = getCookieDomain(createDomainRoutingConfig())
  jar.set(PAUSE_COOKIE, '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
    ...(domain ? { domain } : {}),
  })
}

export async function cancelCurrentWecomFlow() {
  const jar = await cookies()
  const flow = jar.get(FLOW_COOKIE)?.value
  const browser = jar.get(BROWSER_COOKIE)?.value
  try {
    if (flow && browser) await cancelWecomFlow(flow, browser)
  } finally {
    await clearWecomCookies()
    await pauseWecomAutoLogin()
  }
}
