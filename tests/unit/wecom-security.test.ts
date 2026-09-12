import { afterEach, describe, expect, it, vi } from 'vitest'
import { decryptSecret, encryptSecret, safeReturnPath, authOrigin } from '@/lib/wecom/security'
import { buildAuthorizationUrl, exchangeCode } from '@/lib/wecom/provider'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('WeCom security boundary', () => {
  it('encrypts secrets with authenticated encryption and a separate required key', () => {
    vi.stubEnv('WECOM_SECRET_KEY', 'ab'.repeat(32))
    const encrypted = encryptSecret('test-secret')
    expect(encrypted).not.toContain('test-secret')
    expect(decryptSecret(encrypted)).toBe('test-secret')
    expect(encryptSecret('test-secret')).not.toBe(encrypted)
    expect(() => decryptSecret(encrypted.slice(0, -4) + 'AAAA')).toThrow()
    vi.stubEnv('WECOM_SECRET_KEY', '')
    expect(() => encryptSecret('test-secret')).toThrow()
  })

  it.each([
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/api/auth/logout',
    '/login',
    '/%2f%2fevil.test',
    '/admin/../api/auth/logout',
  ])('rejects unsafe return path %s', (value) => {
    expect(safeReturnPath(value)).toBe('/')
  })

  it('preserves ordinary business destinations', () => {
    expect(safeReturnPath('/mobile/orders?tab=pending')).toBe('/mobile/orders?tab=pending')
  })

  it('requires a fixed HTTPS public origin outside local development', () => {
    vi.stubEnv('WECOM_AUTH_ORIGIN', 'https://ops.example.test/path')
    expect(() => authOrigin()).toThrow()
    vi.stubEnv('WECOM_AUTH_ORIGIN', 'http://ops.example.test')
    expect(() => authOrigin()).toThrow()
    vi.stubEnv('WECOM_AUTH_ORIGIN', 'https://ops.example.test')
    expect(authOrigin()).toBe('https://ops.example.test')
  })

  it('uses the saved public origin ahead of the optional environment fallback', () => {
    vi.stubEnv('WECOM_AUTH_ORIGIN', 'https://legacy.example.test')
    expect(authOrigin('https://saved.example.test/')).toBe('https://saved.example.test')
    vi.stubEnv('WECOM_AUTH_ORIGIN', '')
    expect(authOrigin('https://saved.example.test')).toBe('https://saved.example.test')
  })

  it.each([
    'https://user:pass@ops.example.test',
    'https://ops.example.test/path',
    'https://ops.example.test/path/..',
    'https://ops.example.test?code=x',
    'https://ops.example.test#fragment',
    'https://ops.example.test\\',
    'javascript:alert(1)',
  ])('does not fall back when a saved origin is invalid: %s', (value) => {
    vi.stubEnv('WECOM_AUTH_ORIGIN', 'https://legacy.example.test')
    expect(() => authOrigin(value)).toThrow()
  })

  it('permits local HTTP only outside production', () => {
    expect(authOrigin('http://localhost:3018')).toBe('http://localhost:3018')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => authOrigin('http://localhost:3018')).toThrow()
  })

  it('uses only basic identity scope and the configured application', () => {
    const url = new URL(
      buildAuthorizationUrl(
        { corpId: 'corp', agentId: '123' },
        'https://ops.example.test/api/auth/wecom/callback',
        'state'
      )
    )
    expect(url.searchParams.get('scope')).toBe('snsapi_base')
    expect(url.searchParams.get('agentid')).toBe('123')
    expect(url.searchParams.get('state')).toBe('state')
  })

  it('rejects non-members even when the response contains an OpenId', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ access_token: 'test-token', expires_in: 7200 }))
        .mockResolvedValueOnce(Response.json({ errcode: 0, OpenId: 'visitor' }))
    )
    await expect(exchangeCode({ corpId: 'corp', secret: 'secret' }, 'code')).rejects.toThrow()
  })
})
