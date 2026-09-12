import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'
import { normalizeAuthOrigin } from './origin'

export class WecomError extends Error {}

function encryptionKey(): Buffer {
  const key = process.env.WECOM_SECRET_KEY ?? ''
  if (!/^[a-fA-F0-9]{64}$/.test(key)) {
    throw new WecomError('加密主密钥 WECOM_SECRET_KEY 未配置或格式无效，请联系部署管理员')
  }
  return Buffer.from(key, 'hex')
}

export function encryptSecret(secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(Buffer.from('replenops:wecom:v1'))
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}

export function decryptSecret(value: string): string {
  try {
    const [version, iv, tag, data, extra] = value.split('.')
    if (version !== 'v1' || !iv || !tag || !data || extra !== undefined)
      throw new Error('Invalid ciphertext')
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'))
    decipher.setAAD(Buffer.from('replenops:wecom:v1'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    throw new WecomError('企业微信密钥不可用，请联系部署管理员')
  }
}

export function authOrigin(publicOrigin?: string): string {
  try {
    return normalizeAuthOrigin(
      publicOrigin || process.env.WECOM_AUTH_ORIGIN || '',
      process.env.NODE_ENV !== 'production'
    )
  } catch {
    throw new WecomError('企业微信公开登录地址未配置或无效')
  }
}

export { safeReturnPath } from './redirect'

export const randomToken = () => randomBytes(32).toString('base64url')
// Browser-bound random challenges are keyed independently from user password hashing.
export const tokenHash = (value: string) =>
  createHmac('sha256', encryptionKey())
    .update('replenops:wecom:challenge:v1:')
    .update(value)
    .digest('hex')
export const validToken = (value: string | undefined): value is string =>
  Boolean(value && /^[\w-]{43}$/.test(value))

export const FLOW_COOKIE = 'replenops_wecom_flow'
export const BROWSER_COOKIE = 'replenops_wecom_browser'
export const PAUSE_COOKIE = 'replenops_wecom_pause'
export const flowCookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 300,
}
