'use client'

import { ReloadOutlined } from '@ant-design/icons'
import { Button, Result } from 'antd'
import { useTransition } from 'react'

export default function AdminPageError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Result
      status="error"
      title="页面加载失败"
      subTitle="请重试，或选择其他菜单。"
      extra={
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          loading={isPending}
          onClick={() => startTransition(retry)}
        >
          重新加载
        </Button>
      }
    />
  )
}
