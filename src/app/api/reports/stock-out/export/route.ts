import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getUserRoles } from '@/lib/session.server'
import { hasPermission } from '@/lib/rbac'
import { parseMonthlyStockOutFilters } from '@/lib/monthly-stock-out-filters'
import { buildMonthlyStockOutWorkbook } from '@/lib/monthly-stock-out-export'
import { monthlyStockOutReportService } from '@/services/monthly-stock-out-report.service'

const reportPath = '/admin/reports/stock-out'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '用户未登录' }, { status: 401 })
    }

    if (!hasPermission(getUserRoles(user), reportPath)) {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 })
    }

    const filters = parseMonthlyStockOutFilters({
      month: request.nextUrl.searchParams.get('month') ?? undefined,
      keyword: request.nextUrl.searchParams.get('keyword') ?? undefined,
      status: request.nextUrl.searchParams.get('status') ?? undefined,
      warehouseId: request.nextUrl.searchParams.get('warehouseId') ?? undefined,
      storeId: request.nextUrl.searchParams.get('storeId') ?? undefined,
    })
    const report = await monthlyStockOutReportService.getReport(filters)
    const buffer = await buildMonthlyStockOutWorkbook(report)
    const filename = `月度出库报表_${filters.month}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="stock-out-report-${filters.month}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('导出月度出库报表失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '导出失败' },
      { status: 400 }
    )
  }
}
