import { z } from 'zod'
import { WecomError } from './security'

export function buildAuthorizationUrl(
  config: { corpId: string; agentId: string },
  callback: string,
  state: string
): string {
  const url = new URL('https://open.weixin.qq.com/connect/oauth2/authorize')
  url.search = new URLSearchParams({
    appid: config.corpId,
    agentid: config.agentId,
    redirect_uri: callback,
    response_type: 'code',
    scope: 'snsapi_base',
    state,
  }).toString()
  url.hash = 'wechat_redirect'
  return url.toString()
}

async function api(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`https://qyapi.weixin.qq.com/cgi-bin/${path}`)
  url.search = new URLSearchParams(params).toString()
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error('Upstream unavailable')
    return await response.json()
  } catch {
    // Do not log fetch errors: their URL can contain application credentials.
    throw new WecomError('企业微信服务暂时不可用，请稍后重试')
  }
}

const tokenResponse = z.object({
  errcode: z.literal(0).optional(),
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
})
const identityResponse = z.object({
  errcode: z.literal(0).optional(),
  UserId: z.string().min(1).max(128),
})

export async function checkCredentials(config: {
  corpId: string
  secret: string
}): Promise<string> {
  const result = tokenResponse.safeParse(
    await api('gettoken', { corpid: config.corpId, corpsecret: config.secret })
  )
  if (!result.success) throw new WecomError('企业微信凭据或可信 IP 配置无效')
  return result.data.access_token
}

export async function exchangeCode(
  config: { corpId: string; secret: string },
  code: string
): Promise<string> {
  const token = await checkCredentials(config)
  const result = identityResponse.safeParse(
    await api('user/getuserinfo', { access_token: token, code })
  )
  if (!result.success) throw new WecomError('无法识别企业成员，请确认应用可见范围后重试')
  return result.data.UserId
}
