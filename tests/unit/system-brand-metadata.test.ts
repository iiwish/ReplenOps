import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { brand } from '@/config/brand'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  connection: vi.fn(),
  requireActionPermission: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    systemConfig: { findUnique: mocks.findUnique, upsert: mocks.upsert },
    $disconnect: vi.fn(),
  },
}))
vi.mock('next/server', () => ({ connection: mocks.connection }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/action-permissions', () => ({
  requireActionPermission: mocks.requireActionPermission,
}))
vi.mock('@ant-design/nextjs-registry', () => ({ AntdRegistry: () => null }))
vi.mock('@/components/ui/toaster', () => ({ Toaster: () => null }))
vi.mock('@/components/auth/AuthSessionGuard', () => ({ AuthSessionGuard: () => null }))

import { generateMetadata } from '@/app/layout'
import { GET } from '@/app/favicon.ico/route'
import { updateSystemBrand } from '@/actions/system-config-actions'

const logoPath = 'data:image/png;base64,aWNvbg=='
const config = { name: '测试订货平台', logoPath }

describe('system brand browser metadata', () => {
  afterEach(() => vi.unstubAllEnvs())

  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/metadata-test')
    mocks.findUnique.mockResolvedValue(config)
  })

  it('reads the saved identity at request time and uses a versioned HTTP icon URL', async () => {
    const metadata = await generateMetadata()

    expect(mocks.connection).toHaveBeenCalledOnce()
    expect(metadata.title).toEqual({ default: config.name, template: `%s | ${config.name}` })
    expect(metadata.appleWebApp).toMatchObject({ title: config.name })
    expect(metadata.icons).toMatchObject({ icon: expect.stringMatching(/^\/favicon\.ico\?v=\w+$/) })
    expect(JSON.stringify(metadata.icons)).not.toContain('data:')

    mocks.findUnique.mockResolvedValue({ ...config, logoPath: 'data:image/png;base64,bmV3' })
    expect((await generateMetadata()).icons).not.toEqual(metadata.icons)
  })

  it.each(['missing configuration', 'database unavailable', 'no database URL'])(
    'keeps the default brand usable with %s',
    async (scenario) => {
      if (scenario === 'missing configuration') mocks.findUnique.mockResolvedValue(null)
      if (scenario === 'database unavailable')
        mocks.findUnique.mockRejectedValue(new Error('offline'))
      if (scenario === 'no database URL') vi.stubEnv('DATABASE_URL', '')

      const metadata = await generateMetadata()
      expect(metadata.title).toMatchObject({ default: brand.name })
      expect(metadata.icons).toMatchObject({ icon: brand.logoPath })
    }
  )

  it('serves the uploaded image without authentication or stale browser caching', async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from('icon'))
  })

  it.each([brand.logoPath, 'data:image/svg+xml;base64,PHN2Zz4=', 'https://example.com/logo.png'])(
    'uses only the bundled default for a non-uploaded or unsupported icon: %s',
    async (source) => {
      mocks.findUnique.mockResolvedValue({ ...config, logoPath: source })
      const response = await GET()

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(brand.logoPath)
      expect(response.headers.get('cache-control')).toBe('no-store')
    }
  )

  it('revalidates the shared root layout after saving, including login and mobile pages', async () => {
    mocks.upsert.mockResolvedValue(config)

    expect(await updateSystemBrand(config)).toEqual({ success: true, data: config })
    expect(mocks.requireActionPermission).toHaveBeenCalledWith('system:manage')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })

  it('does not invalidate metadata when saving fails', async () => {
    mocks.upsert.mockRejectedValue(new Error('save failed'))

    expect(await updateSystemBrand(config)).toEqual({ success: false, error: 'save failed' })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
})
