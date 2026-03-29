import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { orderingScheduleService } from '@/services/ordering-schedule.service'
import { requireRoles } from '@/lib/rbac-server'

const updateScheduleSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式必须为 HH:mm').optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式必须为 HH:mm').optional(),
  isActive: z.boolean().optional(),
})

// PUT /api/ordering-schedule — 更新时间配置（仅管理员）
export async function PUT(request: NextRequest) {
  try {
    // 仅 SUPER_ADMIN 可修改
    await requireRoles(['SUPER_ADMIN'] as any)

    const body = await request.json()
    const result = updateScheduleSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: '参数验证失败', details: result.error.format() },
        { status: 400 }
      )
    }

    const { dayOfWeek, ...data } = result.data
    const schedule = await orderingScheduleService.updateSchedule(dayOfWeek, data)

    return NextResponse.json({ success: true, data: schedule })
  } catch (error: any) {
    // requireRoles 会抛出 redirect，不在此处理
    console.error('更新报货时间配置失败:', error)
    return NextResponse.json({ success: false, error: '更新配置失败' }, { status: 500 })
  }
}
