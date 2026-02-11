'use client'

import { App, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import React from 'react'

export default function AntdConfigProvider({ children }: { children: React.ReactNode }) {
  return (
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
  )
}
