import { NextResponse } from 'next/server'
import { getCurrentUser, getUserRoles } from '@/lib/session.server'
import { hasPermission } from '@/lib/rbac'
import { reportService } from '@/services/report.service'

const inventoryReportPath = '/admin/reports/inventory'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '用户未登录' }, { status: 401 })
    }

    const roles = getUserRoles(user)
    if (!hasPermission(roles, inventoryReportPath)) {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 })
    }

    const data = await reportService.getInventoryReport()

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('获取库存报表失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取库存报表失败',
      },
      { status: 500 }
    )
  }
}
