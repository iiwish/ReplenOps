import { NextRequest, NextResponse } from 'next/server'
import { revokeSession } from '@/lib/session'
import { cancelCurrentWecomFlow } from '@/lib/wecom/http'

export async function POST() {
  try {
    await revokeSession()
    await cancelCurrentWecomFlow()

    return NextResponse.json({
      success: true,
      message: '登出成功',
    })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ success: false, error: '登出失败' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    await revokeSession()
    await cancelCurrentWecomFlow()

    return NextResponse.redirect(new URL('/login', request.url))
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.redirect(new URL('/login?error=logout_failed', request.url))
  }
}
