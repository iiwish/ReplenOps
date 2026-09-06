import { systemConfigService } from '@/services/system-config.service'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const brandConfig = await systemConfigService.get()

  return <LoginForm brandConfig={brandConfig} />
}
