import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { BROWSER_COOKIE, FLOW_COOKIE } from '@/lib/wecom/security'
import { hasPendingWecomBinding } from '@/services/wecom-auth.service'
import { systemConfigService } from '@/services/system-config.service'
import LoginForm from '../LoginForm'

export const dynamic = 'force-dynamic'

export default async function WecomBindingPage() {
  if (await getCurrentUser()) redirect('/')
  const jar = await cookies()
  const pending = await hasPendingWecomBinding(
    jar.get(FLOW_COOKIE)?.value ?? '',
    jar.get(BROWSER_COOKIE)?.value ?? ''
  )
  if (!pending) redirect('/login?wecomError=1&local=1')
  return <LoginForm brandConfig={await systemConfigService.get()} binding />
}
