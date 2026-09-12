import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createDomainRoutingConfig, getCookieDomain } from '@/lib/domain-routing'
import { cancelWecomFlow } from '@/services/wecom-auth.service'
import { BROWSER_COOKIE, FLOW_COOKIE, PAUSE_COOKIE, flowCookieOptions } from './security'

export function privateResponse(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
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
