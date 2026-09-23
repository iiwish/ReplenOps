import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { localAuth } from '@/lib/auth'
import { setSession } from '@/lib/session'
import {
  authRateLimitService,
  createLoginRateLimitKey,
  getLoginClientAddress,
} from '@/services/auth-rate-limit.service'

const demoRoleSchema = z.object({ role: z.enum(['store', 'warehouse']) })

export async function POST(request: NextRequest) {
  const publicOrigin = process.env.DEMO_PUBLIC_ORIGIN
  if (
    process.env.DEMO_MODE !== 'true' ||
    process.env.APP_ENV !== 'preview' ||
    !publicOrigin ||
    request.headers.get('origin') !== publicOrigin ||
    request.headers.get('host') !== new URL(publicOrigin).host
  ) {
    return NextResponse.json({ success: false, error: '演示登录不可用' }, { status: 404 })
  }

  const parsed = demoRoleSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: '演示角色无效' }, { status: 400 })
  }

  const { role } = parsed.data
  const clientAddress =
    request.headers.get('x-real-ip')?.trim() || getLoginClientAddress(request.headers)
  const rateLimitKey = createLoginRateLimitKey(`demo:${role}`, clientAddress)
  const rateLimit = await authRateLimitService.recordAttempt(rateLimitKey, 60)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: '体验操作过于频繁，请稍后重试' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds ?? 1) } }
    )
  }

  const username = role === 'store' ? 'demo_store' : 'demo_warehouse'
  const requiredRole = role === 'store' ? 'STORE_ADMIN' : 'WAREHOUSE_MANAGER'
  const user = await prisma.user.findUnique({
    where: { username },
    include: { roles: true },
  })
  if (
    !user ||
    !user.isActive ||
    user.isDeleted ||
    !user.roles.some((assignment) => assignment.role === requiredRole)
  ) {
    return NextResponse.json({ success: false, error: '演示账号暂不可用' }, { status: 503 })
  }

  const authUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    isActive: user.isActive,
    roles: user.roles.map((assignment) => assignment.role),
  }
  const tokens = await localAuth.generateTokens(authUser, user.sessionVersion)
  await setSession(tokens.access_token, tokens.refresh_token, tokens.expires_in)

  return NextResponse.json({ success: true, redirect: role === 'store' ? '/mobile' : '/admin' })
}
