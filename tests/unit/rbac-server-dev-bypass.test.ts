import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { isDevBypassAllowed, isDevBypassMode } from '@/lib/rbac-server'

describe('rbac server dev bypass gate', () => {
  it('disables DEV_MODE_BYPASS in production even when explicitly enabled', () => {
    expect(
      isDevBypassAllowed({
        NODE_ENV: 'production',
        APP_ENV: 'local',
        DEV_MODE_BYPASS: 'true',
      })
    ).toBe(false)
  })

  it('disables query-string bypass in preview', () => {
    expect(
      isDevBypassMode('dev=bypass', {
        NODE_ENV: 'development',
        APP_ENV: 'preview',
        DEV_MODE_BYPASS: 'false',
      })
    ).toBe(false)
  })

  it('keeps local development bypass available for developer workflows', () => {
    expect(
      isDevBypassAllowed({
        NODE_ENV: 'development',
        APP_ENV: 'local',
        DEV_MODE_BYPASS: 'true',
      })
    ).toBe(true)
    expect(
      isDevBypassMode('dev=bypass', {
        NODE_ENV: 'development',
        DEV_MODE_BYPASS: 'false',
      })
    ).toBe(true)
  })

  it('uses a normalized role so the role-aware admin navigation remains available', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/rbac-server.ts'), 'utf8')

    expect(source).toContain("roles: ['SUPER_ADMIN']")
    expect(source).not.toContain("roles: ['ADMIN']")
  })
})
