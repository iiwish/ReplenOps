import { NextResponse } from 'next/server'
import { getCurrentUser, getUserRoles } from '@/lib/session.server'
import { hasPermission } from '@/lib/rbac'
import { reportService } from '@/services/report.service'

const inventoryReportPath = '/admin/reports/inventory'

const csvHeaders = [
  '商品编码',
  '商品名称',
  '分类',
  '仓库',
  '库存数量',
  '可用库存',
  '平均成本',
  '库存金额',
]

function escapeCsvCell(value: string | number) {
  const text = String(value)
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`
  }

  return text
}

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
    const rows = data.inventory.map((item) => [
      item.goodsCode,
      item.goodsName,
      item.categoryName,
      item.warehouseName,
      item.quantity,
      item.availableQuantity,
      item.avgCost.toFixed(2),
      item.totalCost.toFixed(2),
    ])

    const csv = [csvHeaders, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
      .join('\n')

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="inventory-report-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error) {
    console.error('导出库存报表失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '导出库存报表失败',
      },
      { status: 500 }
    )
  }
}
