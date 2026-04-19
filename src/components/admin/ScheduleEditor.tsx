'use client'

import { useState, useEffect } from 'react'
import { toast } from '@/hooks/use-toast'
import type { ScheduleItem } from '@/actions/schedule-actions'

const DAYS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
]

interface ScheduleEditorProps {
  initialSchedules: ScheduleItem[]
  onUpdate: (dayOfWeek: number, data: { startTime: string; endTime: string; isActive: boolean }) => Promise<{ success: boolean; error?: string }>
  onReset: () => Promise<{ success: boolean; error?: string }>
}

export default function ScheduleEditor({ initialSchedules, onUpdate, onReset }: ScheduleEditorProps) {
  const [schedules, setSchedules] = useState<Record<number, ScheduleItem>>({})
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [isResetting, setIsResetting] = useState(false)

  useEffect(() => {
    const map: Record<number, ScheduleItem> = {}
    for (const s of initialSchedules) {
      map[s.dayOfWeek] = s
    }
    // Fill in missing days with defaults
    for (const day of DAYS) {
      if (!map[day.value]) {
        map[day.value] = {
          id: 0,
          dayOfWeek: day.value,
          startTime: day.value === 7 ? '00:00' : '07:30',
          endTime: day.value === 7 ? '00:00' : '18:30',
          isActive: day.value !== 7,
        }
      }
    }
    setSchedules(map)
  }, [initialSchedules])

  const handleUpdate = async (dayOfWeek: number) => {
    const s = schedules[dayOfWeek]
    if (!s) return
    setSaving((prev) => ({ ...prev, [dayOfWeek]: true }))
    const result = await onUpdate(dayOfWeek, {
      startTime: s.startTime,
      endTime: s.endTime,
      isActive: s.isActive,
    })
    setSaving((prev) => ({ ...prev, [dayOfWeek]: false }))
    if (result.success) {
      toast({ title: `已保存${DAYS.find((d) => d.value === dayOfWeek)?.label}` })
    } else {
      toast({ title: '保存失败', description: result.error, variant: 'destructive' })
    }
  }

  const handleReset = async () => {
    setIsResetting(true)
    const result = await onReset()
    setIsResetting(false)
    if (result.success) {
      toast({ title: '已重置为默认值（周一至周六 07:30-18:30）' })
      window.location.reload()
    } else {
      toast({ title: '重置失败', description: result.error, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="grid grid-cols-[100px_1fr_1fr_80px_80px] gap-2 text-sm font-medium text-muted-foreground px-1">
        <div>星期</div>
        <div>开始时间</div>
        <div>结束时间</div>
        <div className="text-center">启用</div>
        <div className="text-center">操作</div>
      </div>

      {/* Day rows */}
      {DAYS.map((day) => {
        const s = schedules[day.value]
        if (!s) return null
        return (
          <div
            key={day.value}
            className={`grid grid-cols-[100px_1fr_1fr_80px_80px] gap-2 items-center p-3 rounded-lg border ${
              s.isActive ? 'bg-card' : 'bg-muted/30 opacity-75'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{day.label}</span>
              {!s.isActive && (
                <span className="text-xs text-muted-foreground">(休息日)</span>
              )}
            </div>

            <input
              type="time"
              value={s.startTime}
              onChange={(e) => {
                const nextStartTime = e.target.value
                setSchedules((prev) => {
                  const current = prev[day.value]
                  if (!current) {
                    return prev
                  }

                  return {
                    ...prev,
                    [day.value]: { ...current, startTime: nextStartTime },
                  }
                })
              }}
              disabled={!s.isActive}
              className="h-9 px-3 rounded-md border bg-background text-sm disabled:opacity-50"
            />

            <input
              type="time"
              value={s.endTime}
              onChange={(e) => {
                const nextEndTime = e.target.value
                setSchedules((prev) => {
                  const current = prev[day.value]
                  if (!current) {
                    return prev
                  }

                  return {
                    ...prev,
                    [day.value]: { ...current, endTime: nextEndTime },
                  }
                })
              }}
              disabled={!s.isActive}
              className="h-9 px-3 rounded-md border bg-background text-sm disabled:opacity-50"
            />

            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={s.isActive}
                onChange={(e) => {
                  const isActive = e.target.checked
                  setSchedules((prev) => {
                    const current = prev[day.value]
                    if (!current) {
                      return prev
                    }

                    return {
                      ...prev,
                      [day.value]: {
                        ...current,
                        isActive,
                        startTime: isActive && current.startTime === '00:00' ? '07:30' : current.startTime,
                        endTime: isActive && current.endTime === '00:00' ? '18:30' : current.endTime,
                      },
                    }
                  })
                }}
                className="h-4 w-4 rounded border-gray-400"
              />
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => handleUpdate(day.value)}
                disabled={saving[day.value]}
                className="h-8 px-3 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {saving[day.value] ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        )
      })}

      {/* Reset button */}
      <div className="flex justify-end pt-4 border-t">
        <button
          onClick={handleReset}
          disabled={isResetting}
          className="h-9 px-4 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50"
        >
          {isResetting ? '重置中…' : '重置为默认值（周一至周六 07:30-18:30）'}
        </button>
      </div>
    </div>
  )
}
