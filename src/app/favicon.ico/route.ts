import { brand } from '@/config/brand'
import { systemConfigService } from '@/services/system-config.service'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const config = await systemConfigService.get()
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    config.logoPath
  )
  const contentType = match?.[1]
  const encoded = match?.[2]
  const headers = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }

  if (!contentType || !encoded) {
    return new Response(null, {
      status: 307,
      headers: { ...headers, Location: brand.logoPath },
    })
  }

  // Serve an HTTP image URL so browsers do not need to support data-URI favicons.
  return new Response(Uint8Array.from(Buffer.from(encoded, 'base64')), {
    headers: { ...headers, 'Content-Type': contentType },
  })
}
