import { z } from 'zod'
import { getShanghaiMonth } from '@/lib/shanghai-time'
import type { MonthlyStockOutReportFilters } from '@/services/monthly-stock-out-report.service'

const optionalId = z.string().regex(/^\d+$/).optional()

const filterSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .default(() => getShanghaiMonth(-1)),
  keyword: z.string().trim().max(100).optional(),
  status: z.enum(['COMPLETED', 'CANCELLED']).optional(),
  warehouseId: optionalId,
  storeId: optionalId,
})

export function parseMonthlyStockOutFilters(
  input: Record<string, string | undefined>
): MonthlyStockOutReportFilters {
  const parsed = filterSchema.parse(input)
  return {
    ...parsed,
    keyword: parsed.keyword || undefined,
  }
}
