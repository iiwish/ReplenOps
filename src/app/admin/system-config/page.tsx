import { getOrderingSchedule } from '@/actions/schedule-actions'
import ScheduleEditor from '@/components/admin/ScheduleEditor'

export default async function SystemConfigPage() {
  const result = await getOrderingSchedule()
  const schedules = result.success && result.data ? result.data : []

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">系统配置</h1>
        <p className="text-sm text-muted-foreground mt-1">管理系统各项配置参数</p>
      </div>

      {/* 报货时间配置 */}
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">报货时间配置</h2>
          <p className="text-sm text-muted-foreground mt-1">
            设置允许门店报货的时间窗口。默认：周一至周六 07:30-18:30，周日休息。
          </p>
        </div>
        <div className="p-6">
          <ScheduleEditor initialSchedules={schedules} />
        </div>
      </div>
    </div>
  )
}
