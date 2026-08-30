import { z } from 'zod'

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export const orderingScheduleItemSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(TIME_PATTERN, '时间格式必须为 HH:mm'),
  endTime: z.string().regex(TIME_PATTERN, '时间格式必须为 HH:mm'),
  isActive: z.boolean(),
})

export const orderingScheduleBatchSchema = z
  .array(orderingScheduleItemSchema)
  .length(7, '请完整配置周一至周日')
  .superRefine((schedules, context) => {
    const configuredDays = new Set<number>()

    schedules.forEach((schedule, index) => {
      if (configuredDays.has(schedule.dayOfWeek)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'dayOfWeek'],
          message: '同一天不能重复配置',
        })
      }
      configuredDays.add(schedule.dayOfWeek)

      if (schedule.isActive && schedule.startTime >= schedule.endTime) {
        context.addIssue({
          code: 'custom',
          path: [index, 'endTime'],
          message: '结束时间必须晚于开始时间',
        })
      }
    })

    if (configuredDays.size !== 7) {
      context.addIssue({
        code: 'custom',
        message: '请完整配置周一至周日',
      })
    }
  })

export type OrderingScheduleInput = z.infer<typeof orderingScheduleItemSchema>

export interface ScheduleItem extends OrderingScheduleInput {
  id: number
}

export const DEFAULT_ORDERING_SCHEDULES: OrderingScheduleInput[] = Array.from(
  { length: 7 },
  (_, index) => {
    const dayOfWeek = index + 1
    const isActive = dayOfWeek !== 7

    return {
      dayOfWeek,
      startTime: isActive ? '07:30' : '00:00',
      endTime: isActive ? '18:30' : '00:00',
      isActive,
    }
  }
)
