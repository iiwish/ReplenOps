import { prisma } from '@/lib/prisma'

// ============================================
// 报货时间服务 (Ordering Schedule Service)
// ============================================

const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']

/**
 * 获取一周的时间配置
 */
export async function getSchedule() {
  const schedules = await prisma.orderingSchedule.findMany({
    orderBy: { dayOfWeek: 'asc' },
  })
  return schedules
}

/**
 * 更新某天的时间配置
 */
export async function updateSchedule(
  dayOfWeek: number,
  data: { startTime?: string; endTime?: string; isActive?: boolean }
) {
  const schedule = await prisma.orderingSchedule.upsert({
    where: { dayOfWeek },
    update: {
      ...(data.startTime !== undefined && { startTime: data.startTime }),
      ...(data.endTime !== undefined && { endTime: data.endTime }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    create: {
      dayOfWeek,
      startTime: data.startTime ?? '07:30',
      endTime: data.endTime ?? '18:30',
      isActive: data.isActive ?? true,
    },
  })
  return schedule
}

/**
 * 检查当前时间是否在报货窗口内
 */
export async function isWithinOrderingTime(): Promise<boolean> {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=周日, 1=周一, ...
  // 转换为 1=周一, 7=周日
  const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek

  const schedule = await prisma.orderingSchedule.findUnique({
    where: { dayOfWeek: adjustedDay },
  })

  if (!schedule || !schedule.isActive) {
    return false
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startParts = schedule.startTime.split(':').map(Number)
  const endParts = schedule.endTime.split(':').map(Number)
  const startH = startParts[0] ?? 0,
    startM = startParts[1] ?? 0
  const endH = endParts[0] ?? 0,
    endM = endParts[1] ?? 0
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes
}

/**
 * 返回当前是否可报货的详细信息
 */
export async function getOrderingStatus(): Promise<{
  isOpen: boolean
  todaySchedule: { startTime: string; endTime: string; isActive: boolean } | null
  nextOrderingTime: { dayOfWeek: number; dayName: string; startTime: string } | null
  weeklySchedules: Array<{
    dayOfWeek: number
    startTime: string
    endTime: string
    isActive: boolean
  }>
  currentTime: string
}> {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek

  const schedules = await prisma.orderingSchedule.findMany({
    orderBy: { dayOfWeek: 'asc' },
  })
  const schedule = schedules.find((item) => item.dayOfWeek === adjustedDay) ?? null
  const weeklySchedules = Array.from({ length: 7 }, (_, index) => {
    const day = index + 1
    const configured = schedules.find((item) => item.dayOfWeek === day)

    return {
      dayOfWeek: day,
      startTime: configured?.startTime ?? '--:--',
      endTime: configured?.endTime ?? '--:--',
      isActive: configured?.isActive ?? false,
    }
  })

  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  // 检查今天是否在窗口内
  let isOpen = false
  if (schedule && schedule.isActive) {
    const startParts = schedule.startTime.split(':').map(Number)
    const endParts = schedule.endTime.split(':').map(Number)
    const startH = startParts[0] ?? 0,
      startM = startParts[1] ?? 0
    const endH = endParts[0] ?? 0,
      endM = endParts[1] ?? 0
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    isOpen = currentMinutes >= startMinutes && currentMinutes <= endMinutes
  }

  // 计算下一次可报货时间
  let nextOrderingTime: { dayOfWeek: number; dayName: string; startTime: string } | null = null

  if (!isOpen) {
    const todayStartParts = schedule?.startTime.split(':').map(Number)
    const todayStartMinutes = (todayStartParts?.[0] ?? 0) * 60 + (todayStartParts?.[1] ?? 0)

    if (schedule?.isActive && currentMinutes < todayStartMinutes) {
      nextOrderingTime = {
        dayOfWeek: adjustedDay,
        dayName: '今天',
        startTime: schedule.startTime,
      }
    }

    // 当前时间已过今天窗口，或今天没有报货安排，从明天开始找最近的报货日。
    for (let i = 1; i <= 7 && !nextOrderingTime; i++) {
      const checkDay = ((adjustedDay + i - 1) % 7) + 1
      const nextSchedule = schedules.find((item) => item.dayOfWeek === checkDay)
      if (nextSchedule && nextSchedule.isActive) {
        nextOrderingTime = {
          dayOfWeek: checkDay,
          dayName: DAY_NAMES[checkDay] ?? '未知',
          startTime: nextSchedule.startTime ?? '07:30',
        }
        break
      }
    }
  }

  return {
    isOpen,
    todaySchedule: schedule
      ? { startTime: schedule.startTime, endTime: schedule.endTime, isActive: schedule.isActive }
      : null,
    nextOrderingTime,
    weeklySchedules,
    currentTime: now.toISOString(),
  }
}

// ============================================
// Service Export（兼容现有调用方式）
// ============================================
export const orderingScheduleService = {
  async getSchedule() {
    return getSchedule()
  },

  async updateSchedule(
    dayOfWeek: number,
    data: { startTime?: string; endTime?: string; isActive?: boolean }
  ) {
    return updateSchedule(dayOfWeek, data)
  },

  async isWithinOrderingTime() {
    return isWithinOrderingTime()
  },

  async getOrderingStatus() {
    return getOrderingStatus()
  },
}
