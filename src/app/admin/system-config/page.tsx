import { getOrderingSchedule } from '@/actions/schedule-actions'
import ScheduleEditor from '@/components/admin/ScheduleEditor'

export default async function SystemConfigPage() {
  const result = await getOrderingSchedule()
  const schedules = result.success && result.data ? result.data : []

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">系统配置</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理系统各项配置参数</p>
      </div>

      <section>
        <div className="border-b pb-4">
          <h2 className="text-lg font-semibold">报货时间设置</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            设置允许门店报货的时间窗口。默认：周一至周六 07:30-18:30，周日休息。
          </p>
        </div>
        <div className="pt-6">
          <ScheduleEditor initialSchedules={schedules} />
        </div>
      </section>
    </div>
  )
}
