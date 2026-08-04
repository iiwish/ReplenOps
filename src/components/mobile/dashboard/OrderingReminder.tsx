'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Clock } from 'lucide-react'

interface OrderingStatus {
  isOpen: boolean
  todaySchedule: { startTime: string; endTime: string; isActive: boolean } | null
  nextOrderingTime: { dayOfWeek: number; dayName: string; startTime: string } | null
  weeklySchedules?: Array<{
    dayOfWeek: number
    startTime: string
    endTime: string
    isActive: boolean
  }>
  currentTime: string
}

interface OrderingReminderProps {
  variant?: 'home' | 'compact'
}

const DAY_NAMES = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']

export function OrderingReminder({ variant = 'compact' }: OrderingReminderProps) {
  const [status, setStatus] = useState<OrderingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showWeeklySchedule, setShowWeeklySchedule] = useState(false)

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/ordering-schedule/status')
        const data = await res.json()
        if (data.success) {
          setStatus(data.data)
        }
      } catch (error) {
        console.error('获取报货状态失败:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchStatus()
  }, [])

  if (loading) {
    return null
  }

  if (!status) {
    return null
  }

  const currentDate = new Date(status.currentTime)
  const dayOfWeek = currentDate.getDay()
  const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek
  const todayName = DAY_NAMES[adjustedDay] ?? '今日'
  const todayScheduleLabel = status.todaySchedule
    ? status.todaySchedule.isActive
      ? `${todayName} ${status.todaySchedule.startTime}–${status.todaySchedule.endTime}`
      : `${todayName} 暂停报货`
    : `${todayName} 暂无安排`
  const nextOrderingLabel = status.nextOrderingTime
    ? `${status.nextOrderingTime.dayName} ${status.nextOrderingTime.startTime}`
    : null
  const weeklySchedules = status.weeklySchedules ?? []

  if (variant === 'compact' && status.isOpen) {
    return null
  }

  if (variant === 'home') {
    return (
      <section
        aria-labelledby="mobile-ordering-schedule-heading"
        className={`rounded-lg border px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
          status.isOpen ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${
                status.isOpen
                  ? 'bg-white/80 text-emerald-600 ring-emerald-200'
                  : 'bg-white/80 text-amber-600 ring-amber-200'
              }`}
            >
              {status.isOpen ? (
                <CheckCircle2 className="h-[18px] w-[18px]" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-[18px] w-[18px]" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <h2
                id="mobile-ordering-schedule-heading"
                className={`text-sm font-semibold ${
                  status.isOpen ? 'text-emerald-900' : 'text-amber-900'
                }`}
              >
                报货时间
              </h2>
              <p
                className={`mt-0.5 truncate text-xs ${
                  status.isOpen ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {todayScheduleLabel}
              </p>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${
              status.isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {status.isOpen ? '当前可报货' : '暂不可报货'}
          </span>
        </div>
        {!status.isOpen && nextOrderingLabel && (
          <div className="mt-2 border-t border-amber-200/80 pt-2 text-xs text-amber-700">
            下次可报货：{nextOrderingLabel}
          </div>
        )}
        {weeklySchedules.length > 0 && (
          <>
            <button
              type="button"
              aria-expanded={showWeeklySchedule}
              onClick={() => setShowWeeklySchedule((expanded) => !expanded)}
              className={`mt-2 flex w-full items-center justify-between border-t pt-2 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                status.isOpen
                  ? 'border-emerald-200/80 text-emerald-700'
                  : 'border-amber-200/80 text-amber-700'
              }`}
            >
              <span>查看本周报货时间</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showWeeklySchedule ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
            {showWeeklySchedule && (
              <div className="mt-2 space-y-1 border-t border-gray-900/5 pt-2">
                {weeklySchedules.map((schedule) => {
                  const isToday = schedule.dayOfWeek === adjustedDay
                  const dayName = DAY_NAMES[schedule.dayOfWeek] ?? '未知'

                  return (
                    <div
                      key={schedule.dayOfWeek}
                      className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs ${
                        isToday ? 'bg-white/70 font-medium' : ''
                      }`}
                    >
                      <span>{isToday ? `${dayName}（今天）` : dayName}</span>
                      <span>
                        {schedule.isActive
                          ? `${schedule.startTime}–${schedule.endTime}`
                          : '暂停报货'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </section>
    )
  }

  return (
    <div className="mx-3 mb-2 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-amber-900">
          {status.todaySchedule?.isActive ? '当前不在报货时间内' : `${todayName} 暂停报货`}
        </p>
        <p className="mt-0.5 truncate text-xs text-amber-700">
          {nextOrderingLabel ? `下次可报货：${nextOrderingLabel}` : todayScheduleLabel}
        </p>
      </div>
    </div>
  )
}
