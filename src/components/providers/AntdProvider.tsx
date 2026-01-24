'use client'

import { AntdRegistry } from '@ant-design/nextjs-registry'
import { App, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import React from 'react'

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry hashPriority="low">
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#1890ff',
            borderRadius: 6,
          },
        }}
      >
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  )
}
