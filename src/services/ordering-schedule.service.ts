import { prisma } from '@/lib/prisma'
import { getShanghaiClock } from '@/lib/shanghai-time'

// ============================================
// 报货时间服务 (Ordering Schedule Service)
// ============================================

const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

interface OrderingWindow {
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

function parseTimeToMinutes(value: string): number | null {
  if (!TIME_PATTERN.test(value)) return null

  const [hours, minutes] = value.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

export function isOrderingWindowOpen(schedule: OrderingWindow | null, now = new Date()): boolean {
  if (!schedule?.isActive) return false

  const clock = getShanghaiClock(now)
  if (schedule.dayOfWeek !== clock.dayOfWeek) return false

  const startMinutes = parseTimeToMinutes(schedule.startTime)
  const endMinutes = parseTimeToMinutes(schedule.endTime)
  if (startMinutes === null || endMinutes === null || startMinutes > endMinutes) return false

  return clock.minutesSinceMidnight >= startMinutes && clock.minutesSinceMidnight <= endMinutes
}

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
export async function isWithinOrderingTime(now = new Date()): Promise<boolean> {
  const { dayOfWeek } = getShanghaiClock(now)

  const schedule = await prisma.orderingSchedule.findUnique({
    where: { dayOfWeek },
  })

  return isOrderingWindowOpen(schedule, now)
}

/**
 * 返回当前是否可报货的详细信息
 */
export async function getOrderingStatus(now = new Date()): Promise<{
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
  const clock = getShanghaiClock(now)
  const adjustedDay = clock.dayOfWeek

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

  const currentMinutes = clock.minutesSinceMidnight

  // 检查今天是否在窗口内
  const isOpen = isOrderingWindowOpen(schedule, now)

  // 计算下一次可报货时间
  let nextOrderingTime: { dayOfWeek: number; dayName: string; startTime: string } | null = null

  if (!isOpen) {
    const todayStartMinutes = schedule ? parseTimeToMinutes(schedule.startTime) : null

    if (schedule?.isActive && todayStartMinutes !== null && currentMinutes < todayStartMinutes) {
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

export async function assertWithinOrderingTime(now = new Date()): Promise<void> {
  const status = await getOrderingStatus(now)
  if (status.isOpen) return

  if (status.nextOrderingTime) {
    throw new Error(
      `当前不在报货时间内，下次报货时间为${status.nextOrderingTime.dayName} ${status.nextOrderingTime.startTime}`
    )
  }

  throw new Error('当前不在报货时间内，请联系管理员配置报货时间')
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

  async isWithinOrderingTime(now = new Date()) {
    return isWithinOrderingTime(now)
  },

  async getOrderingStatus(now = new Date()) {
    return getOrderingStatus(now)
  },

  async assertWithinOrderingTime(now = new Date()) {
    return assertWithinOrderingTime(now)
  },
}
