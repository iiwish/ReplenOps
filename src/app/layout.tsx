import type { Metadata, Viewport } from 'next'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { Toaster } from '@/components/ui/toaster'
import { AuthSessionGuard } from '@/components/auth/AuthSessionGuard'
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
    default: 'ReplenOps',
    template: '%s | ReplenOps',
  },
  description: '门店订货与库存协同平台',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ReplenOps',
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
