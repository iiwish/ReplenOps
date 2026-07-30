import { NextRequest, NextResponse } from 'next/server'
import { buildCsv } from '@/lib/csv'
import { hasPermission } from '@/lib/rbac'
import { formatShanghaiDateTime, getShanghaiDateRange } from '@/lib/shanghai-time'
import { getCurrentUser, getUserRoles } from '@/lib/session.server'
import { inventoryLogService } from '@/services/inventory-log.service'

const pagePath = '/admin/inventory/logs'

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
    const range = getShanghaiDateRange(
      query.get('startDate') ?? undefined,
      query.get('endDate') ?? undefined
    )
    const result = await inventoryLogService.list({
      page: 1,
      pageSize: 50_000,
      warehouseId: query.get('warehouseId') ?? undefined,
      goodsId: query.get('goodsId') ?? undefined,
      changeTypes: query.get('changeTypes')?.split(',').filter(Boolean),
      startDate: range.start,
      endDateExclusive: range.endExclusive,
      operatorId: query.get('operatorId') ?? undefined,
    })
    const csv = buildCsv([
      [
        '变动时间',
        '仓库',
        '商品编码',
        '商品名称',
        '变动类型',
        '变动数量',
        '变动前库存',
        '变动后库存',
        '关联单据类型',
        '关联单据ID',
        '操作人',
        '备注',
      ],
      ...result.data.map((item) => [
        formatShanghaiDateTime(item.createdAt),
        item.warehouseName,
        item.goodsCode,
        item.goodsName,
        item.changeType,
        item.quantity,
        item.beforeQty,
        item.afterQty,
        item.referenceType,
        item.referenceId,
        item.operatorName,
        item.remark,
      ]),
    ])

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="inventory-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('导出库存变动日志失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '导出失败' },
      { status: 400 }
    )
  }
}
