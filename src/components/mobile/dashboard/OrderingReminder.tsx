'use client'

import { useEffect, useState } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'

interface OrderingStatus {
  isOpen: boolean
  todaySchedule: { startTime: string; endTime: string; isActive: boolean } | null
  nextOrderingTime: { dayOfWeek: number; dayName: string; startTime: string } | null
  currentTime: string
}

export function OrderingReminder() {
  const [status, setStatus] = useState<OrderingStatus | null>(null)
  const [loading, setLoading] = useState(true)

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

  // 可报货状态 — 不显示提示
  if (status.isOpen) {
    return null
  }

  // 非报货时间，显示提醒
  const dayNames = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const now = new Date()
  const dayOfWeek = now.getDay()
  const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek
  const todayName = dayNames[adjustedDay]

  return (
    <div className="mx-4 mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-center gap-2">
        {status.todaySchedule && !status.todaySchedule.isActive ? (
          <>
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">{todayName} 休息</p>
              {status.nextOrderingTime && (
                <p className="text-xs text-amber-600">
                  下次报货：{status.nextOrderingTime.dayName} {status.nextOrderingTime.startTime}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {todayName} 报货时间 {status.todaySchedule?.startTime}–{status.todaySchedule?.endTime}
              </p>
              {status.nextOrderingTime ? (
                <p className="text-xs text-amber-600">
                  下次报货：{status.nextOrderingTime.dayName} {status.nextOrderingTime.startTime}
                </p>
              ) : (
                <p className="text-xs text-amber-600">当前不在报货时间内</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
