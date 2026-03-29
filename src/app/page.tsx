import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { cookies } from 'next/headers'
import type { UserRole } from '@/types'
import { ROLE_PERMISSIONS } from '@/lib/rbac'
import PlatformSwitch from '@/components/PlatformSwitch'

// 开发模式模拟用户（有所有权限）
function getMockUser() {
  return {
    id: 'dev-user-1',
    username: 'dev_user',
    name: '开发者',
    role: 'super_admin' as UserRole,
  }
}

// 获取用户角色列表
function getUserRoles(user: { role: UserRole }): UserRole[] {
  return [user.role]
}

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

// 从 cookie 获取用户偏好的平台
async function getPlatformPreference(): Promise<'admin' | 'mobile' | null> {
  const cookieStore = await cookies()
  const pref = cookieStore.get('erp_platform_preference')?.value
  if (pref === '/admin') return 'admin'
  if (pref === '/mobile') return 'mobile'
  return null
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const isDevMode = params.dev === 'bypass'

  const headersList = await headers()
  const isMobileDevice = detectMobileDevice(headersList)

  // 获取用户信息
  // 生产环境: 从 session 获取
  // 开发环境: 使用模拟用户
  const user = isDevMode ? getMockUser() : null

  // 如果未登录，重定向到登录页
  if (!user) {
    redirect('/login')
  }

  const roles = getUserRoles(user)
  const { canAccessAdmin, canAccessMobile } = checkPlatformAccess(roles)
  const platformPreference = await getPlatformPreference()

  // 只有一个权限 → 直接跳转
  if (canAccessAdmin && !canAccessMobile) {
    redirect('/admin')
  }
  if (canAccessMobile && !canAccessAdmin) {
    redirect('/mobile')
  }

  // 双重权限 → 显示平台切换界面
  // 自动判断当前设备类型作为默认选中
  const defaultPlatform: 'admin' | 'mobile' = isMobileDevice ? 'mobile' : 'admin'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">ReplenOps</h1>
          <p className="text-muted-foreground">
            欢迎回来，<span className="font-medium text-foreground">{user.name}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            检测到您正在使用 {isMobileDevice ? '移动设备' : '电脑'}，
            将为您跳转到{defaultPlatform === 'mobile' ? '移动端' : '管理端'}
          </p>
        </div>

        {/* Platform Switch */}
        <div className="flex justify-center">
          <PlatformSwitch
            hasAdmin={canAccessAdmin}
            hasMobile={canAccessMobile}
            currentPlatform={defaultPlatform}
          />
        </div>

        {/* Auto-redirect hint */}
        <p className="text-center text-sm text-muted-foreground">
          页面将在 3 秒后自动跳转…
        </p>

        {/* Auto-redirect script */}
        <AutoRedirect
          targetPlatform={platformPreference || defaultPlatform}
          isMobileDevice={isMobileDevice}
        />
      </div>
    </main>
  )
}

// 客户端自动跳转组件
function AutoRedirect({ isMobileDevice }: { isMobileDevice: boolean }) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            var pref = document.cookie.match(/erp_platform_preference=([^;]+)/);
            var target = pref && pref[1] === '/admin' ? '/admin' : '/mobile';
            // If user has a preference cookie, respect it; otherwise use device detection
            var finalTarget = (pref && pref[1]) || (${isMobileDevice} ? '/mobile' : '/admin');
            setTimeout(function() {
              window.location.href = finalTarget;
            }, 3000);
          })();
        `,
      }}
    />
  )
}
