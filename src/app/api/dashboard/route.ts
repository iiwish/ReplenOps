import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session.server'
import { dashboardService } from '@/services/dashboard.service'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: '用户未登录' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const storeId = searchParams.get('storeId') || undefined

    const [stats, todoList] = await Promise.all([
      dashboardService.getTodayStats(storeId, user),
      dashboardService.getTodoList(storeId, user),
    ])

    return NextResponse.json({
      success: true,
      data: {
        stats,
        todoList: [todoList.pendingOrders, todoList.containersToReturn],
      },
    })
  } catch (error) {
    console.error('获取移动端首页数据失败:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '获取数据失败',
      },
      { status: 500 }
    )
  }
}
