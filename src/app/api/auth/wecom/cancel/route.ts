import { cancelCurrentWecomFlow, localRedirect } from '@/lib/wecom/http'

export async function GET() {
  await cancelCurrentWecomFlow()
  return localRedirect('/login?local=1')
}
