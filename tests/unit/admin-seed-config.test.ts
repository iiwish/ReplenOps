import { describe, expect, it } from 'vitest'
import { resolveDefaultAdminConfig } from '../../prisma/seed-config'

describe('admin seed configuration', () => {
  it('requires ADMIN_INITIAL_PASSWORD in production', () => {
    expect(() =>
      resolveDefaultAdminConfig({
        NODE_ENV: 'production',
        APP_ENV: 'production',
        ADMIN_USERNAME: 'admin',
      })
    ).toThrow('ADMIN_INITIAL_PASSWORD')
  })

  it('requires ADMIN_INITIAL_PASSWORD in preview', () => {
    expect(() =>
      resolveDefaultAdminConfig({
        NODE_ENV: 'development',
        APP_ENV: 'preview',
        ADMIN_USERNAME: 'preview-admin',
      })
    ).toThrow('ADMIN_INITIAL_PASSWORD')
  })

  it('allows local development username default only outside production and preview', () => {
    const config = resolveDefaultAdminConfig({
      NODE_ENV: 'development',
      APP_ENV: 'local',
      ADMIN_INITIAL_PASSWORD: 'local-only-password',
    })

    expect(config.username).toBe('admin')
    expect(config.password).toBe('local-only-password')
    expect(config.isProtectedRuntime).toBe(false)
  })

  it('uses environment-provided credentials without exposing password in printable metadata', () => {
    const config = resolveDefaultAdminConfig({
      NODE_ENV: 'production',
      APP_ENV: 'production',
      ADMIN_USERNAME: 'replenops-admin',
      ADMIN_INITIAL_PASSWORD: 'strong-secret-from-env',
    })

    expect(config.username).toBe('replenops-admin')
    expect(config.password).toBe('strong-secret-from-env')
    expect(config.logSafeSummary).toEqual({
      username: 'replenops-admin',
      passwordProvided: true,
      isProtectedRuntime: true,
    })
  })
})
