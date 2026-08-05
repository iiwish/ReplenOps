import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { setSession } from '@/lib/session'
import { localAuth } from '@/lib/auth'

const loginSchema = z.object({
  identifier: z.string().min(1, '用户名或手机号不能为空'),
  password: z.string().min(1, '密码不能为空'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = loginSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: '参数验证失败', details: result.error.format() },
        { status: 400 }
      )
    }

    const { identifier, password } = result.data

    const authResult = await localAuth.verifyCredentials(identifier, password)

    if (!authResult.success || !authResult.user || !authResult.tokens) {
      return NextResponse.json(
        { success: false, error: authResult.error || '登录失败' },
        { status: 401 }
      )
    }

    await setSession(
      authResult.tokens.access_token,
      authResult.tokens.refresh_token,
      authResult.tokens.expires_in
    )

    return NextResponse.json({
      success: true,
      user: {
        id: authResult.user.id,
        username: authResult.user.username,
        name: authResult.user.name,
        email: authResult.user.email,
        phone: authResult.user.phone,
        avatar: authResult.user.avatar,
        roles: authResult.user.roles,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ success: false, error: '登录失败' }, { status: 500 })
  }
}
