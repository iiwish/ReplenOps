import ExcelJS from 'exceljs'
import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { buildMonthlyStockOutWorkbook } from '@/lib/monthly-stock-out-export'
import { parseMonthlyStockOutFilters } from '@/lib/monthly-stock-out-filters'
import type { MonthlyStockOutReportData } from '@/services/monthly-stock-out-report.service'

const report: MonthlyStockOutReportData = {
  period: {
    month: '2026-06',
    start: new Date('2026-05-31T16:00:00.000Z'),
    endExclusive: new Date('2026-06-30T16:00:00.000Z'),
  },
  summary: {
    stockOutCount: 1,
    storeCount: 1,
    totalQuantity: 2,
    issueAmount: 25,
    revokedCount: 0,
    revokedAmount: 0,
    netIssueAmount: 25,
    warningCount: 0,
  },
  rows: [
    {
      id: '11',
      stockOutCode: 'SO-001',
      orderId: '21',
      orderCode: 'OR-001',
      completedAt: new Date('2026-06-15T04:30:00.000Z'),
      orderedAt: new Date('2026-06-14T01:00:00.000Z'),
      storeName: '测试门店',
      warehouseName: '测试仓库',
      status: 'COMPLETED',
      issueAmount: 25,
      orderAmount: 30,
      creatorName: '测试用户',
      orderStatus: 'COMPLETED',
      remark: '月度测试',
      revokedAt: null,
      revokeReason: null,
      warnings: [],
    },
  ],
  details: [
    {
      stockOutId: '11',
      stockOutCode: 'SO-001',
      orderCode: 'OR-001',
      completedAt: new Date('2026-06-15T04:30:00.000Z'),
      storeName: '测试门店',
      warehouseName: '测试仓库',
      goodsCode: 'G-001',
      goodsName: '测试商品',
      goodsSpec: '10kg',
      goodsUnit: '袋',
      quantity: 2,
      issueUnitPrice: 12.5,
      issueAmount: 25,
      status: 'COMPLETED',
    },
  ],
}

describe('monthly stock-out export', () => {
  it('creates summary and detail worksheets with Shanghai timestamps', async () => {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.read(Readable.from(await buildMonthlyStockOutWorkbook(report)))

    expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual(['出库汇总', '商品明细'])
    const summarySheet = workbook.getWorksheet('出库汇总')
    const detailSheet = workbook.getWorksheet('商品明细')
    expect(summarySheet?.rowCount).toBe(2)
    expect(summarySheet?.getRow(2).getCell(2).value).toBe('SO-001')
    expect(summarySheet?.getRow(2).getCell(5).value).toBe('2026-06-15 12:30:00')
    expect(detailSheet?.rowCount).toBe(2)
    expect(detailSheet?.getRow(2).getCell(7).value).toBe('G-001')
  })

  it('normalizes supported filters and rejects invalid values', () => {
    expect(
      parseMonthlyStockOutFilters({
        month: '2026-06',
        status: 'COMPLETED',
        warehouseId: '2',
        keyword: '  SO-001  ',
      })
    ).toEqual({
      month: '2026-06',
      status: 'COMPLETED',
      warehouseId: '2',
      keyword: 'SO-001',
    })

    expect(() => parseMonthlyStockOutFilters({ month: '2026-13' })).toThrow()
    expect(() => parseMonthlyStockOutFilters({ month: '2026-06', storeId: 'abc' })).toThrow()
  })
})
