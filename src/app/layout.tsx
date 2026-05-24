import type { Metadata, Viewport } from 'next'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'ReplenOps',
  description: 'Enterprise Resource Planning System',
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
        <AntdRegistry hashPriority="low">{children}</AntdRegistry>
      </body>
    </html>
  )
}
