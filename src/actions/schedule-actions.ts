'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActionPermission } from '@/lib/action-permissions'
import { orderingScheduleService } from '@/services/ordering-schedule.service'
import {
  DEFAULT_ORDERING_SCHEDULES,
  orderingScheduleBatchSchema,
  type ScheduleItem,
} from '@/types/ordering-schedule.types'

export type { ScheduleItem } from '@/types/ordering-schedule.types'

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? fallback
  }

  return error instanceof Error ? error.message : fallback
}

export async function getOrderingSchedule(): Promise<{
  success: boolean
  data?: ScheduleItem[]
  error?: string
}> {
  try {
    await requireActionPermission('stock:read')
    const schedules = await orderingScheduleService.getSchedule()
    return {
      success: true,
      data: schedules.map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isActive: s.isActive,
      })),
    }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, '获取报货时间失败') }
  }
}

export async function saveOrderingSchedule(
  input: unknown
): Promise<{ success: boolean; data?: ScheduleItem[]; error?: string }> {
  try {
    await requireActionPermission('system:manage')
    const schedules = orderingScheduleBatchSchema.parse(input)
    const saved = await orderingScheduleService.updateSchedules(schedules)
    revalidatePath('/admin/system-config')
    return { success: true, data: saved }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, '保存报货时间失败') }
  }
}

export async function resetScheduleToDefault(): Promise<{
  success: boolean
  data?: ScheduleItem[]
  error?: string
}> {
  try {
    await requireActionPermission('system:manage')
    const saved = await orderingScheduleService.updateSchedules(DEFAULT_ORDERING_SCHEDULES)
    revalidatePath('/admin/system-config')
    return { success: true, data: saved }
  } catch (error) {
    return { success: false, error: getErrorMessage(error, '恢复默认设置失败') }
  }
}
