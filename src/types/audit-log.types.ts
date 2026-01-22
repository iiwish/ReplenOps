import { z } from 'zod'

export const listAuditLogsSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  actions: z.array(z.string()).optional(),
  operatorId: z.string().optional(),
  orderId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>
