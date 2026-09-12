import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { bindWecomWithPassword, getWecomAuthOrigin } from '@/services/wecom-auth.service'
import {
  authRateLimitService,
  createLoginRateLimitKey,
  getLoginClientAddress,
} from '@/services/auth-rate-limit.service'
import { getCurrentUser, setSession } from '@/lib/session'
import { BROWSER_COOKIE, FLOW_COOKIE, WecomError } from '@/lib/wecom/security'
import { clearWecomCookies, privateResponse, resumeWecomAutoLogin } from '@/lib/wecom/http'

const schema = z.object({
  identifier: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(1024),
})
export async function POST(request: NextRequest) {
  try {
    const requestOrigin = request.headers.get('origin') ?? ''
    if (requestOrigin !== (await getWecomAuthOrigin()))
      return privateResponse(
        NextResponse.json({ success: false, error: '请求来源无效' }, { status: 403 })
      )
    if (await getCurrentUser())
      return privateResponse(
        NextResponse.json(
          { success: false, error: '请先退出当前账号，再进行关联' },
          { status: 409 }
        )
      )
    const { identifier, password } = schema.parse(await request.json())
    const jar = await cookies()
    const token = jar.get(FLOW_COOKIE)?.value ?? ''
    const browser = jar.get(BROWSER_COOKIE)?.value ?? ''
    const address = getLoginClientAddress(request.headers)
    const keys = [
      createLoginRateLimitKey(identifier, address),
      createLoginRateLimitKey(`wecom:bind:${browser}`, address),
    ]
    for (const key of keys) {
      const limit = await authRateLimitService.check(key)
      if (!limit.allowed)
        return privateResponse(
          NextResponse.json(
            { success: false, error: '验证过于频繁，请稍后重试' },
            { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds ?? 60) } }
          )
        )
    }
    let result: Awaited<ReturnType<typeof bindWecomWithPassword>>
    try {
      result = await bindWecomWithPassword(token, browser, identifier, password, requestOrigin)
    } catch (error) {
      for (const key of keys) await authRateLimitService.recordFailure(key)
      throw error
    }
    await setSession(
      result.tokens.access_token,
      result.tokens.refresh_token,
      result.tokens.expires_in
    )
    await clearWecomCookies()
    await resumeWecomAutoLogin()
    for (const key of keys) await authRateLimitService.clear(key)
    return privateResponse(NextResponse.json({ success: true, redirect: result.returnPath }))
  } catch (error) {
    const message = error instanceof WecomError ? error.message : '关联失败，请重新登录或联系管理员'
    return privateResponse(NextResponse.json({ success: false, error: message }, { status: 400 }))
  }
}
