import { requirePageAccess } from '@/lib/rbac-server'
import { parseMonthlyStockOutFilters } from '@/lib/monthly-stock-out-filters'
import { monthlyStockOutReportService } from '@/services/monthly-stock-out-report.service'
import MonthlyStockOutReportClient from './MonthlyStockOutReportClient'

interface SearchParams {
  month?: string
  keyword?: string
  status?: string
  warehouseId?: string
  storeId?: string
}

export default async function MonthlyStockOutReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requirePageAccess('/admin/reports/stock-out')
  const params = await searchParams
  const filters = parseMonthlyStockOutFilters({
    month: params.month,
    keyword: params.keyword,
    status: params.status,
    warehouseId: params.warehouseId,
    storeId: params.storeId,
  })
  const [report, options] = await Promise.all([
    monthlyStockOutReportService.getReport(filters),
    monthlyStockOutReportService.getOptions(),
  ])

  return <MonthlyStockOutReportClient initialData={report} options={options} filters={filters} />
}
