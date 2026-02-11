import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

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
      <body className={inter.className}>
        <AntdRegistry hashPriority="low">{children}</AntdRegistry>
      </body>
    </html>
  )
}
