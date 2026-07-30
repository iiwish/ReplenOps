import { NextRequest, NextResponse } from 'next/server'
import { buildCsv } from '@/lib/csv'
import { hasPermission } from '@/lib/rbac'
import { formatShanghaiDateTime } from '@/lib/shanghai-time'
import { getCurrentUser, getUserRoles } from '@/lib/session.server'
import { costService } from '@/services/cost.service'

const pagePath = '/admin/inventory/cost-history'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '用户未登录' }, { status: 401 })
    }
    if (!hasPermission(getUserRoles(user), pagePath)) {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 })
    }

    const query = request.nextUrl.searchParams
    const result = await costService.listHistory({
      page: 1,
      pageSize: 50_000,
      warehouseId: query.get('warehouseId') ?? undefined,
      goodsId: query.get('goodsId') ?? undefined,
      startDate: query.get('startDate') ?? undefined,
      endDate: query.get('endDate') ?? undefined,
    })
    const csv = buildCsv([
      [
        '变动时间',
        '仓库',
        '商品编码',
        '商品名称',
        '单位',
        '变动前成本',
        '变动后成本',
        '成本变动',
        '成本变动比例(%)',
        '变动前数量',
        '变动后数量',
        '入库数量',
        '入库价格',
        '关联单据类型',
        '关联单据ID',
      ],
      ...result.data.map((item) => [
        formatShanghaiDateTime(item.createdAt),
        item.warehouseName,
        item.goodsCode,
        item.goodsName,
        item.goodsUnit,
        item.beforeCost.toFixed(2),
        item.afterCost.toFixed(2),
        item.costChange.toFixed(2),
        item.costChangePercent.toFixed(2),
        item.beforeQty,
        item.afterQty,
        item.inQty,
        item.inPrice.toFixed(2),
        item.referenceType,
        item.referenceId,
      ]),
    ])

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="cost-history-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('导出成本历史失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '导出失败' },
      { status: 400 }
    )
  }
}
