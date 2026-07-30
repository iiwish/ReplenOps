import * as XLSX from 'xlsx'
import type { MonthlyStockOutReportData } from '@/services/monthly-stock-out-report.service'
import { formatShanghaiDateTime } from '@/lib/shanghai-time'

const STOCK_STATUS_LABELS: Record<string, string> = {
  PENDING: '待出库',
  APPROVED: '已审批',
  REJECTED: '已拒绝',
  PROCESSING: '处理中',
  COMPLETED: '已出库',
  CANCELLED: '已撤销',
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: '待审批',
  APPROVED: '已审批',
  REJECTED: '已拒绝',
  PROCESSING: '配货中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

export function buildMonthlyStockOutWorkbook(report: MonthlyStockOutReportData): Buffer {
  const summaryHeaders = [
    '出库单ID',
    '出库单号',
    '历史出库单号',
    '订单ID',
    '订单号',
    '历史订单号',
    '实际出库时间',
    '下单时间',
    '门店',
    '仓库',
    '出库状态',
    '出库金额',
    '订单金额',
    '订单创建人',
    '订单状态',
    '订单备注',
    '撤销时间',
    '撤销原因',
    '异常提示',
  ]
  const summaryRows = report.rows.map((row) => [
    row.id,
    row.stockOutCode,
    row.legacyStockOutCode ?? '',
    row.orderId,
    row.orderCode,
    row.legacyOrderCode ?? '',
    formatShanghaiDateTime(row.completedAt),
    formatShanghaiDateTime(row.orderedAt),
    row.storeName,
    row.warehouseName,
    STOCK_STATUS_LABELS[row.status] ?? row.status,
    row.issueAmount,
    row.orderAmount,
    row.creatorName,
    ORDER_STATUS_LABELS[row.orderStatus] ?? row.orderStatus,
    row.remark ?? '',
    formatShanghaiDateTime(row.revokedAt),
    row.revokeReason ?? '',
    row.warnings.join('；'),
  ])

  const detailHeaders = [
    '出库单ID',
    '出库单号',
    '订单号',
    '实际出库时间',
    '门店',
    '仓库',
    '商品编码',
    '商品名称',
    '规格',
    '单位',
    '出库数量',
    '内部领用单价',
    '出库金额',
    '出库状态',
  ]
  const detailRows = report.details.map((row) => [
    row.stockOutId,
    row.stockOutCode,
    row.orderCode,
    formatShanghaiDateTime(row.completedAt),
    row.storeName,
    row.warehouseName,
    row.goodsCode,
    row.goodsName,
    row.goodsSpec ?? '',
    row.goodsUnit,
    row.quantity,
    row.issueUnitPrice,
    row.issueAmount,
    STOCK_STATUS_LABELS[row.status] ?? row.status,
  ])

  const workbook = XLSX.utils.book_new()
  const summarySheet = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows])
  const detailSheet = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows])
  summarySheet['!cols'] = summaryHeaders.map((header) => ({ wch: Math.max(header.length * 2, 12) }))
  detailSheet['!cols'] = detailHeaders.map((header) => ({ wch: Math.max(header.length * 2, 12) }))
  XLSX.utils.book_append_sheet(workbook, summarySheet, '出库汇总')
  XLSX.utils.book_append_sheet(workbook, detailSheet, '商品明细')

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}
