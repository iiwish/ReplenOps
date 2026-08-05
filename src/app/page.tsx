import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { UserRole } from '@/types'
import { ROLE_PERMISSIONS } from '@/lib/rbac'
import { getCurrentUser, getUserRoles } from '@/lib/session'
import { buildCanonicalPlatformUrl, createDomainRoutingConfig } from '@/lib/domain-routing'
import PlatformSwitch from '@/components/PlatformSwitch'

// 检测是否为移动设备
function detectMobileDevice(headersList: Headers) {
  const ua = headersList.get('user-agent') || ''
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
}

// 检查用户是否有权限访问指定平台
function checkPlatformAccess(roles: UserRole[]) {
  let canAccessAdmin = false
  let canAccessMobile = false

  for (const role of roles) {
    const perms = ROLE_PERMISSIONS[role]
    if (perms) {
      if (perms.canAccessAdmin) canAccessAdmin = true
      if (perms.canAccessMobile) canAccessMobile = true
    }
  }

  return { canAccessAdmin, canAccessMobile }
}

export default async function HomePage() {
  const headersList = await headers()
  const isMobileDevice = detectMobileDevice(headersList)
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') || 'http'
  const currentUrl = `${protocol}://${host}/`
  const domainRoutingConfig = createDomainRoutingConfig()

  // 获取当前登录用户
  const user = await getCurrentUser()

  // 如果未登录，重定向到登录页
  if (!user) {
    redirect('/login')
  }

  const roles = getUserRoles(user)
  const { canAccessAdmin, canAccessMobile } = checkPlatformAccess(roles)

  // 只有一个权限 → 直接跳转
  if (canAccessAdmin && !canAccessMobile) {
    redirect('/admin')
  }
  if (canAccessMobile && !canAccessAdmin) {
    redirect('/mobile')
  }

  // 双重权限 → 显示平台切换界面
  // 自动判断当前设备类型作为默认平台；域名已配置时由 proxy 负责默认入口
  const defaultPlatform: 'admin' | 'mobile' = isMobileDevice ? 'mobile' : 'admin'
  const selectedPlatform = defaultPlatform
  const platformUrls = {
    admin: buildCanonicalPlatformUrl('admin', currentUrl, domainRoutingConfig),
    mobile: buildCanonicalPlatformUrl('mobile', currentUrl, domainRoutingConfig),
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/20 p-6">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold text-foreground">ReplenOps</h1>
          <p className="text-muted-foreground">
            欢迎回来，<span className="font-medium text-foreground">{user.name}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            检测到您正在使用 {isMobileDevice ? '移动设备' : '电脑'}， 将为您跳转到
            {selectedPlatform === 'mobile' ? '移动端' : '管理端'}
          </p>
        </div>

        {/* Platform Switch */}
        <div className="flex justify-center">
          <PlatformSwitch
            hasAdmin={canAccessAdmin}
            hasMobile={canAccessMobile}
            currentPlatform={selectedPlatform}
            platformUrls={platformUrls}
          />
        </div>

        {/* Auto-redirect hint */}
        <p className="text-center text-sm text-muted-foreground">页面将在 3 秒后自动跳转…</p>

        {/* Auto-redirect script */}
        <AutoRedirect targetUrl={platformUrls[selectedPlatform]} />
      </div>
    </main>
  )
}

// 客户端自动跳转组件
export function AutoRedirect({ targetUrl }: { targetUrl: string }) {
  const escapedTargetUrl = JSON.stringify(targetUrl)

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            setTimeout(function() {
              window.location.href = ${escapedTargetUrl};
            }, 3000);
          })();
        `,
      }}
    />
  )
}
