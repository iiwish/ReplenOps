import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/demo/route'

afterEach(() => vi.unstubAllEnvs())

function request(origin: string, role: string): NextRequest {
  return new NextRequest('https://replenops-demo.ouvo.ai/api/auth/demo', {
    method: 'POST',
    headers: { Origin: origin, Host: 'replenops-demo.ouvo.ai', 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
}

describe('demo authentication boundary', () => {
  it('is unavailable outside the explicit preview demo environment', async () => {
    vi.stubEnv('DEMO_MODE', '')
    vi.stubEnv('APP_ENV', 'production')
    vi.stubEnv('DEMO_PUBLIC_ORIGIN', 'https://replenops-demo.ouvo.ai')
    expect((await POST(request('https://replenops-demo.ouvo.ai', 'store'))).status).toBe(404)
  })

  it('rejects a foreign origin and unsupported role before touching the database', async () => {
    vi.stubEnv('DEMO_MODE', 'true')
    vi.stubEnv('APP_ENV', 'preview')
    vi.stubEnv('DEMO_PUBLIC_ORIGIN', 'https://replenops-demo.ouvo.ai')
    expect((await POST(request('https://untrusted.example', 'store'))).status).toBe(404)
    expect((await POST(request('https://replenops-demo.ouvo.ai', 'owner'))).status).toBe(400)
  })
})
