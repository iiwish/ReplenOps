import { NextResponse } from 'next/server'
import { getUserStores } from '@/actions/store-actions'

/**
 * GET /api/stores/user
 * 获取当前用户可访问的所有门店
 */
export async function GET() {
  try {
    const result = await getUserStores()

    if (!result.success) {
      return NextResponse.json({ error: result.message || '获取门店列表失败' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    })
  } catch (error) {
    console.error('Error fetching user stores:', error)
    return NextResponse.json({ error: '获取门店列表失败' }, { status: 500 })
  }
}
