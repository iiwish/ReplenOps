import { systemConfigService } from '@/services/system-config.service'
import LoginForm from './LoginForm'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Route } from 'next'
import { getCurrentUser } from '@/lib/session'
import { getWecomLoginOptions } from '@/services/wecom-auth.service'
import { PAUSE_COOKIE, safeReturnPath } from '@/lib/wecom/security'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; local?: string; wecomError?: string }>
}) {
  const params = await searchParams
  const returnPath = safeReturnPath(params.redirect)
  if ((await getCurrentUser()) && params.local !== '1') redirect(returnPath as Route)
  const options = await getWecomLoginOptions()
  const isWecom = /wxwork/i.test((await headers()).get('user-agent') ?? '')
  const startUrl = `/api/auth/wecom/start?redirect=${encodeURIComponent(returnPath)}`
  if (
    options.autoLogin &&
    isWecom &&
    params.local !== '1' &&
    !params.wecomError &&
    !(await cookies()).has(PAUSE_COOKIE)
  )
    redirect(startUrl as Route)
  const brandConfig = await systemConfigService.get()

  return (
    <LoginForm
      brandConfig={brandConfig}
      wecomUrl={options.enabled && isWecom ? startUrl : undefined}
      initialError={params.wecomError ? '企业微信登录未完成，请重试或使用账号密码登录' : undefined}
    />
  )
}
