import { describe, expect, it } from 'vitest'
import {
  formatShanghaiDateTime,
  getShanghaiDate,
  getShanghaiDateRange,
  getShanghaiMonth,
  getShanghaiMonthRange,
} from '@/lib/shanghai-time'

describe('Shanghai report time boundaries', () => {
  it('formats a date using the Shanghai calendar day', () => {
    expect(getShanghaiDate(new Date('2026-08-08T16:30:00.000Z'))).toBe('2026-08-09')
  })

  it('builds a half-open month range in China Standard Time', () => {
    const range = getShanghaiMonthRange('2026-06')

    expect(range.start.toISOString()).toBe('2026-05-31T16:00:00.000Z')
    expect(range.endExclusive.toISOString()).toBe('2026-06-30T16:00:00.000Z')
  })

  it('includes the complete selected end date without crossing its Shanghai boundary', () => {
    const range = getShanghaiDateRange('2026-06-01', '2026-06-30')

    expect(range.start?.toISOString()).toBe('2026-05-31T16:00:00.000Z')
    expect(range.endExclusive?.toISOString()).toBe('2026-06-30T16:00:00.000Z')
  })

  it('calculates current and previous month from Shanghai time', () => {
    const utcBeforeShanghaiMidnight = new Date('2026-06-30T16:30:00.000Z')

    expect(getShanghaiMonth(0, utcBeforeShanghaiMidnight)).toBe('2026-07')
    expect(getShanghaiMonth(-1, utcBeforeShanghaiMidnight)).toBe('2026-06')
  })

  it('formats timestamps in Shanghai time', () => {
    expect(formatShanghaiDateTime(new Date('2026-06-01T00:30:45.000Z'))).toBe('2026-06-01 08:30:45')
  })

  it('rejects invalid calendar values', () => {
    expect(() => getShanghaiMonthRange('2026-13')).toThrow('月份无效')
    expect(() => getShanghaiDateRange('2026-02-30', '2026-03-01')).toThrow('日期无效')
  })
})
