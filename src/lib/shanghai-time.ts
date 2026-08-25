const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/

interface CalendarDate {
  year: number
  month: number
  day: number
}

export interface DateRange {
  start?: Date
  endExclusive?: Date
}

export interface RequiredDateRange {
  start: Date
  endExclusive: Date
}

export interface ShanghaiClock {
  dayOfWeek: number
  minutesSinceMidnight: number
}

function parseCalendarDate(value: string): CalendarDate {
  const match = DATE_PATTERN.exec(value)
  if (!match) {
    throw new Error(`日期格式无效: ${value}`)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const normalized = new Date(Date.UTC(year, month - 1, day))

  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() !== month - 1 ||
    normalized.getUTCDate() !== day
  ) {
    throw new Error(`日期无效: ${value}`)
  }

  return { year, month, day }
}

function shanghaiStartOfDay(value: string, dayOffset = 0): Date {
  const { year, month, day } = parseCalendarDate(value)
  return new Date(Date.UTC(year, month - 1, day + dayOffset) - SHANGHAI_OFFSET_MS)
}

export function getShanghaiDateRange(startDate?: string, endDate?: string): DateRange {
  return {
    start: startDate ? shanghaiStartOfDay(startDate) : undefined,
    endExclusive: endDate ? shanghaiStartOfDay(endDate, 1) : undefined,
  }
}

export function getShanghaiMonthRange(month: string): RequiredDateRange {
  const match = MONTH_PATTERN.exec(month)
  if (!match) {
    throw new Error(`月份格式无效: ${month}`)
  }

  const year = Number(match[1])
  const monthNumber = Number(match[2])
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error(`月份无效: ${month}`)
  }

  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1) - SHANGHAI_OFFSET_MS),
    endExclusive: new Date(Date.UTC(year, monthNumber, 1) - SHANGHAI_OFFSET_MS),
  }
}

export function getShanghaiMonth(offset = 0, now = new Date()): string {
  const shanghaiNow = new Date(now.getTime() + SHANGHAI_OFFSET_MS)
  const monthStart = new Date(
    Date.UTC(shanghaiNow.getUTCFullYear(), shanghaiNow.getUTCMonth() + offset, 1)
  )
  const year = monthStart.getUTCFullYear()
  const month = String(monthStart.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function getShanghaiDate(now = new Date()): string {
  const shifted = new Date(now.getTime() + SHANGHAI_OFFSET_MS)
  const year = shifted.getUTCFullYear()
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getShanghaiClock(now = new Date()): ShanghaiClock {
  const shifted = new Date(now.getTime() + SHANGHAI_OFFSET_MS)
  const utcDay = shifted.getUTCDay()

  return {
    dayOfWeek: utcDay === 0 ? 7 : utcDay,
    minutesSinceMidnight: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  }
}

export function formatShanghaiDateTime(value: Date | null): string {
  if (!value) return '-'

  const shifted = new Date(value.getTime() + SHANGHAI_OFFSET_MS)
  const year = shifted.getUTCFullYear()
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  const hour = String(shifted.getUTCHours()).padStart(2, '0')
  const minute = String(shifted.getUTCMinutes()).padStart(2, '0')
  const second = String(shifted.getUTCSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}
