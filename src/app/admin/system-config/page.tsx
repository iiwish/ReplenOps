import { requirePageAccess } from '@/lib/rbac-server'
import { systemConfigService } from '@/services/system-config.service'
import SystemBrandEditor from '@/components/admin/SystemBrandEditor'

export default async function SystemConfigPage() {
  await requirePageAccess('/admin/system-config')
  const config = await systemConfigService.get()

  return (
    <div className="container mx-auto max-w-3xl p-6">
      <section>
        <div className="border-b pb-4">
          <h2 className="text-lg font-semibold">品牌信息</h2>
          <p className="mt-1 text-sm text-muted-foreground">更新管理端使用的系统名称和 Logo。</p>
        </div>
        <div className="pt-6">
          <SystemBrandEditor initialConfig={config} />
        </div>
      </section>
    </div>
  )
}
