import { describe, expect, it } from 'vitest'
import {
  buildCanonicalPlatformUrl,
  classifyDomainHost,
  createDomainRoutingConfig,
  getCookieDomain,
  getCrossDomainRedirectUrl,
  getPathWithSearch,
  getRootRedirectPath,
} from '@/lib/domain-routing'

const routingConfig = createDomainRoutingConfig({
  ADMIN_HOSTS: 'admin.example.com, admin.test.example.com',
  MOBILE_HOSTS: 'mobile.example.com, mobile.test.example.com',
  CANONICAL_ADMIN_HOST: 'admin.test.example.com',
  CANONICAL_MOBILE_HOST: 'mobile.test.example.com',
  APP_ENV: 'preview',
})

describe('domain-routing', () => {
  it('classifies admin, mobile, localhost, and unknown hosts', () => {
    expect(classifyDomainHost('admin.test.example.com', routingConfig)).toBe('admin')
    expect(classifyDomainHost('MOBILE.TEST.EXAMPLE.COM', routingConfig)).toBe('mobile')
    expect(classifyDomainHost('localhost:3001', routingConfig)).toBe('local')
    expect(classifyDomainHost('127.0.0.1:3001', routingConfig)).toBe('local')
    expect(classifyDomainHost('preview-random.vercel.app', routingConfig)).toBe('unknown')
  })

  it('resolves the root entry by hostname only for configured domains', () => {
    expect(getRootRedirectPath('https://admin.test.example.com/', routingConfig)).toBe('/admin')
    expect(getRootRedirectPath('https://mobile.test.example.com/', routingConfig)).toBe('/mobile')
    expect(getRootRedirectPath('http://localhost:3001/', routingConfig)).toBeNull()
    expect(getRootRedirectPath('https://preview-random.vercel.app/', routingConfig)).toBeNull()
  })

  it('builds cross-domain redirect URLs while preserving path and query', () => {
    expect(
      getCrossDomainRedirectUrl(
        'https://admin.test.example.com/mobile/orders?redirect=%2Fmobile%2Fhome',
        routingConfig
      )
    ).toBe('https://mobile.test.example.com/mobile/orders?redirect=%2Fmobile%2Fhome')

    expect(
      getCrossDomainRedirectUrl(
        'https://mobile.test.example.com/admin/orders/123?tab=items',
        routingConfig
      )
    ).toBe('https://admin.test.example.com/admin/orders/123?tab=items')
  })

  it('does not force cross-domain redirects on localhost or unknown hosts', () => {
    expect(
      getCrossDomainRedirectUrl(
        'http://localhost:3001/mobile/orders?redirect=/mobile',
        routingConfig
      )
    ).toBeNull()
    expect(
      getCrossDomainRedirectUrl('https://preview-random.vercel.app/admin/orders', routingConfig)
    ).toBeNull()
  })

  it('builds canonical platform URLs when canonical hosts are configured', () => {
    expect(
      buildCanonicalPlatformUrl(
        'admin',
        'https://mobile.test.example.com/mobile/orders?from=mobile',
        routingConfig
      )
    ).toBe('https://admin.test.example.com/admin')

    expect(
      buildCanonicalPlatformUrl(
        'mobile',
        'https://admin.test.example.com/admin/orders',
        routingConfig
      )
    ).toBe('https://mobile.test.example.com/mobile')
  })

  it('preserves ports in canonical platform hosts for local verification', () => {
    const localCanonicalConfig = createDomainRoutingConfig({
      CANONICAL_ADMIN_HOST: 'localhost:3001',
      CANONICAL_MOBILE_HOST: '127.0.0.1:3002',
      APP_ENV: 'local',
    })

    expect(
      buildCanonicalPlatformUrl(
        'admin',
        'http://localhost:3000/mobile/orders',
        localCanonicalConfig
      )
    ).toBe('http://localhost:3001/admin')

    expect(
      buildCanonicalPlatformUrl(
        'mobile',
        'http://localhost:3000/admin/orders',
        localCanonicalConfig
      )
    ).toBe('http://127.0.0.1:3002/mobile')
  })

  it('keeps complete local redirect paths for login redirects', () => {
    expect(getPathWithSearch('https://admin.test.example.com/admin/orders/1?tab=items')).toBe(
      '/admin/orders/1?tab=items'
    )
  })

  it('only applies COOKIE_DOMAIN in production', () => {
    expect(
      getCookieDomain(
        createDomainRoutingConfig({
          APP_ENV: 'preview',
          COOKIE_DOMAIN: '.example.com',
        })
      )
    ).toBeUndefined()

    expect(
      getCookieDomain(
        createDomainRoutingConfig({
          APP_ENV: 'production',
          COOKIE_DOMAIN: '.example.com',
        })
      )
    ).toBe('.example.com')
  })
})
