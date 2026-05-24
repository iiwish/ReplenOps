import { NextResponse } from 'next/server'
import { orderingScheduleService } from '@/services/ordering-schedule.service'

// GET /api/ordering-schedule/status — 返回当前是否可报货
export async function GET() {
  try {
    const status = await orderingScheduleService.getOrderingStatus()
    return NextResponse.json({ success: true, data: status })
  } catch (error) {
    console.error('获取报货状态失败:', error)
    return NextResponse.json({ success: false, error: '获取状态失败' }, { status: 500 })
  }
}
