import { describe, expect, it } from 'vitest'
import { getShanghaiClock } from '@/lib/shanghai-time'
import { isOrderingWindowOpen } from '@/services/ordering-schedule.service'

const tuesdaySchedule = {
  dayOfWeek: 2,
  startTime: '07:30',
  endTime: '18:30',
  isActive: true,
}

describe('ordering schedule business time', () => {
  it('uses Shanghai time even when the runtime clock is UTC', () => {
    const afterClosingInShanghai = new Date('2026-08-25T10:31:00.000Z')

    expect(getShanghaiClock(afterClosingInShanghai)).toEqual({
      dayOfWeek: 2,
      minutesSinceMidnight: 18 * 60 + 31,
    })
    expect(isOrderingWindowOpen(tuesdaySchedule, afterClosingInShanghai)).toBe(false)
  })

  it('enforces both time boundaries to the configured minute', () => {
    expect(isOrderingWindowOpen(tuesdaySchedule, new Date('2026-08-24T23:29:00.000Z'))).toBe(false)
    expect(isOrderingWindowOpen(tuesdaySchedule, new Date('2026-08-24T23:30:00.000Z'))).toBe(true)
    expect(isOrderingWindowOpen(tuesdaySchedule, new Date('2026-08-25T10:30:00.000Z'))).toBe(true)
    expect(isOrderingWindowOpen(tuesdaySchedule, new Date('2026-08-25T10:31:00.000Z'))).toBe(false)
  })

  it('fails closed for inactive, malformed, or inverted schedules', () => {
    expect(isOrderingWindowOpen({ ...tuesdaySchedule, isActive: false })).toBe(false)
    expect(isOrderingWindowOpen({ ...tuesdaySchedule, startTime: '25:00' })).toBe(false)
    expect(isOrderingWindowOpen({ ...tuesdaySchedule, startTime: '18:30', endTime: '07:30' })).toBe(
      false
    )
  })
})
