import type { Metadata, Viewport } from 'next'
import { createHash } from 'node:crypto'
import { connection } from 'next/server'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { Toaster } from '@/components/ui/toaster'
import { AuthSessionGuard } from '@/components/auth/AuthSessionGuard'
import { brand } from '@/config/brand'
import { systemConfigService } from '@/services/system-config.service'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export async function generateMetadata(): Promise<Metadata> {
  // Read runtime settings instead of baking build-time defaults into page metadata.
  await connection()
  const config = await systemConfigService.get()
  const iconVersion = createHash('sha256').update(config.logoPath).digest('hex').slice(0, 16)

  return {
    title: {
      default: config.name,
      template: `%s | ${config.name}`,
    },
    description: brand.description,
    icons: {
      icon: config.logoPath === brand.logoPath ? brand.logoPath : `/favicon.ico?v=${iconVersion}`,
      apple: '/icons/icon-192x192.png',
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: config.name,
    },
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry hashPriority="low">
          <AuthSessionGuard />
          {children}
          <Toaster />
        </AntdRegistry>
      </body>
    </html>
  )
}
