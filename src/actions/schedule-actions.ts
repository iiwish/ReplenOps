'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export interface ScheduleItem {
  id: number
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

export async function getOrderingSchedule(): Promise<{
  success: boolean
  data?: ScheduleItem[]
  error?: string
}> {
  try {
    const schedules = await prisma.orderingSchedule.findMany({
      orderBy: { dayOfWeek: 'asc' },
    })
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
    return { success: false, error: String(error) }
  }
}

export async function updateOrderingSchedule(
  dayOfWeek: number,
  data: { startTime: string; endTime: string; isActive: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.orderingSchedule.upsert({
      where: { dayOfWeek },
      update: {
        startTime: data.startTime,
        endTime: data.endTime,
        isActive: data.isActive,
      },
      create: {
        dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        isActive: data.isActive,
      },
    })
    revalidatePath('/admin/system-config')
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function resetScheduleToDefault(): Promise<{ success: boolean; error?: string }> {
  try {
    const defaults = [
      { dayOfWeek: 1, startTime: '07:30', endTime: '18:30', isActive: true },  // 周一
      { dayOfWeek: 2, startTime: '07:30', endTime: '18:30', isActive: true },  // 周二
      { dayOfWeek: 3, startTime: '07:30', endTime: '18:30', isActive: true },  // 周三
      { dayOfWeek: 4, startTime: '07:30', endTime: '18:30', isActive: true },  // 周四
      { dayOfWeek: 5, startTime: '07:30', endTime: '18:30', isActive: true },  // 周五
      { dayOfWeek: 6, startTime: '07:30', endTime: '18:30', isActive: true },  // 周六
      { dayOfWeek: 7, startTime: '00:00', endTime: '00:00', isActive: false }, // 周日休息
    ]

    for (const d of defaults) {
      await prisma.orderingSchedule.upsert({
        where: { dayOfWeek: d.dayOfWeek },
        update: d,
        create: d,
      })
    }

    revalidatePath('/admin/system-config')
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
