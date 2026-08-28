import type { Metadata, Viewport } from 'next'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { Toaster } from '@/components/ui/toaster'
import { AuthSessionGuard } from '@/components/auth/AuthSessionGuard'
import { brand } from '@/config/brand'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: {
    default: brand.name,
    template: `%s | ${brand.name}`,
  },
  description: brand.description,
  icons: {
    icon: brand.logoPath,
    apple: '/icons/icon-192x192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: brand.name,
  },
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
