import { NextResponse } from 'next/server'
import { setSession } from '@/lib/session'
import { refreshAccessToken } from '@/lib/auth-edge'
import { cookies } from 'next/headers'

const COOKIE_CONFIG = {
  REFRESH_TOKEN: 'replenops_refresh_token',
}

export async function POST() {
  try {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get(COOKIE_CONFIG.REFRESH_TOKEN)?.value

    if (!refreshToken) {
      return NextResponse.json({ success: false, error: '刷新令牌不存在' }, { status: 401 })
    }

    const newToken = await refreshAccessToken(refreshToken)

    if (!newToken) {
      return NextResponse.json({ success: false, error: '刷新令牌失败' }, { status: 401 })
    }

    await setSession(
      newToken.access_token,
      newToken.refresh_token || refreshToken,
      newToken.expires_in
    )

    return NextResponse.json({
      success: true,
      expires_in: newToken.expires_in,
      scope: newToken.scope || 'read',
    })
  } catch (error) {
    console.error('Refresh token error:', error)
    return NextResponse.json({ success: false, error: '刷新令牌失败' }, { status: 500 })
  }
}
