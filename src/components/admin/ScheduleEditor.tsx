'use client'

import { useMemo, useState } from 'react'
import { Modal, Switch } from 'antd'
import { AlertCircle, RotateCcw, Save } from 'lucide-react'
import { resetScheduleToDefault, saveOrderingSchedule } from '@/actions/schedule-actions'
import { Button } from '@/components/ui/button'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'
import { toast } from '@/hooks/use-toast'
import {
  orderingScheduleBatchSchema,
  type OrderingScheduleInput,
  type ScheduleItem,
} from '@/types/ordering-schedule.types'

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
}

function createScheduleMap(initialSchedules: ScheduleItem[]): Record<number, ScheduleItem> {
  const map: Record<number, ScheduleItem> = {}
  for (const schedule of initialSchedules) {
    map[schedule.dayOfWeek] = { ...schedule }
  }
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
  return map
}

function toScheduleInputs(schedules: Record<number, ScheduleItem>): OrderingScheduleInput[] {
  return DAYS.map((day) => {
    const schedule = schedules[day.value]
    if (!schedule) {
      throw new Error(`缺少${day.label}的报货时间`)
    }

    return {
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      isActive: schedule.isActive,
    }
  })
}

function schedulesMatch(
  current: Record<number, ScheduleItem>,
  saved: Record<number, ScheduleItem>
): boolean {
  return DAYS.every((day) => {
    const currentSchedule = current[day.value]
    const savedSchedule = saved[day.value]
    return (
      currentSchedule?.startTime === savedSchedule?.startTime &&
      currentSchedule?.endTime === savedSchedule?.endTime &&
      currentSchedule?.isActive === savedSchedule?.isActive
    )
  })
}

export default function ScheduleEditor({ initialSchedules }: ScheduleEditorProps) {
  const initialMap = useMemo(() => createScheduleMap(initialSchedules), [initialSchedules])
  const [schedules, setSchedules] = useState<Record<number, ScheduleItem>>(initialMap)
  const [savedSchedules, setSavedSchedules] = useState<Record<number, ScheduleItem>>(initialMap)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const scheduleInputs = useMemo(() => toScheduleInputs(schedules), [schedules])
  const isDirty = useMemo(
    () => !schedulesMatch(schedules, savedSchedules),
    [savedSchedules, schedules]
  )
  const validationResult = useMemo(
    () => orderingScheduleBatchSchema.safeParse(scheduleInputs),
    [scheduleInputs]
  )
  const validationErrors = useMemo(() => {
    const errors: Record<number, string> = {}
    if (validationResult.success) return errors

    for (const issue of validationResult.error.issues) {
      const index = issue.path[0]
      if (typeof index !== 'number') continue
      const schedule = scheduleInputs[index]
      if (schedule && !errors[schedule.dayOfWeek]) {
        errors[schedule.dayOfWeek] = issue.message
      }
    }
    return errors
  }, [scheduleInputs, validationResult])

  useUnsavedChangesWarning(isDirty, '当前报货时间尚未保存，确定离开吗？')

  const updateSchedule = (dayOfWeek: number, changes: Partial<ScheduleItem>) => {
    setSchedules((currentSchedules) => {
      const current = currentSchedules[dayOfWeek]
      if (!current) return currentSchedules

      return {
        ...currentSchedules,
        [dayOfWeek]: { ...current, ...changes },
      }
    })
  }

  const handleSave = async () => {
    if (!validationResult.success || !isDirty) return

    setIsSaving(true)
    const result = await saveOrderingSchedule(validationResult.data)
    setIsSaving(false)

    if (result.success && result.data) {
      const savedMap = createScheduleMap(result.data)
      setSchedules(savedMap)
      setSavedSchedules(savedMap)
      toast({ title: '报货时间已保存' })
    } else {
      toast({ title: '保存失败', description: result.error, variant: 'destructive' })
    }
  }

  const handleReset = () => {
    Modal.confirm({
      title: '恢复默认报货时间？',
      content: '周一至周六将恢复为 07:30-18:30，周日设为休息日。',
      okText: '恢复默认',
      cancelText: '取消',
      onOk: async () => {
        setIsResetting(true)
        const result = await resetScheduleToDefault()
        setIsResetting(false)

        if (result.success && result.data) {
          const savedMap = createScheduleMap(result.data)
          setSchedules(savedMap)
          setSavedSchedules(savedMap)
          toast({ title: '已恢复默认报货时间' })
          return
        }

        toast({ title: '恢复失败', description: result.error, variant: 'destructive' })
        throw new Error(result.error ?? '恢复默认设置失败')
      },
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[100px_1fr_1fr_80px] gap-3 px-3 text-sm font-medium text-muted-foreground">
        <div>星期</div>
        <div>开始时间</div>
        <div>结束时间</div>
        <div className="text-center">启用</div>
      </div>

      {DAYS.map((day) => {
        const schedule = schedules[day.value]
        if (!schedule) return null

        return (
          <div
            key={day.value}
            className={`grid grid-cols-[100px_1fr_1fr_80px] items-center gap-3 rounded-md border p-3 ${
              schedule.isActive ? 'bg-card' : 'bg-muted/30'
            }`}
          >
            <div className="min-w-0">
              <span className="font-medium">{day.label}</span>
              {!schedule.isActive && (
                <span className="ml-1 text-xs text-muted-foreground">休息</span>
              )}
            </div>

            <input
              type="time"
              value={schedule.startTime}
              onChange={(event) => updateSchedule(day.value, { startTime: event.target.value })}
              disabled={!schedule.isActive}
              aria-label={`${day.label}开始时间`}
              className="h-9 min-w-0 rounded-md border bg-background px-3 text-sm disabled:opacity-50"
            />

            <input
              type="time"
              value={schedule.endTime}
              onChange={(event) => updateSchedule(day.value, { endTime: event.target.value })}
              disabled={!schedule.isActive}
              aria-label={`${day.label}结束时间`}
              aria-invalid={Boolean(validationErrors[day.value])}
              className="h-9 min-w-0 rounded-md border bg-background px-3 text-sm disabled:opacity-50"
            />

            <div className="flex justify-center">
              <Switch
                size="small"
                checked={schedule.isActive}
                aria-label={`${day.label}报货开关`}
                onChange={(isActive) =>
                  updateSchedule(day.value, {
                    isActive,
                    startTime:
                      isActive && schedule.startTime === '00:00' ? '07:30' : schedule.startTime,
                    endTime: isActive && schedule.endTime === '00:00' ? '18:30' : schedule.endTime,
                  })
                }
              />
            </div>

            {validationErrors[day.value] && (
              <p className="col-span-2 col-start-2 flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                {validationErrors[day.value]}
              </p>
            )}
          </div>
        )
      })}

      <div className="h-12" aria-hidden="true" />

      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t bg-white/95 pt-4 backdrop-blur">
        <div className="text-sm">
          {isDirty ? (
            <span className="font-medium text-amber-700">有未保存更改</span>
          ) : (
            <span className="text-muted-foreground">所有更改已保存</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isSaving || isResetting}
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            {isResetting ? '恢复中...' : '恢复默认'}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!isDirty || !validationResult.success || isSaving || isResetting}
          >
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            {isSaving ? '保存中...' : '保存本周设置'}
          </Button>
        </div>
      </div>
    </div>
  )
}
