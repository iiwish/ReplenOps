'use client'

import { useTransition } from 'react'
import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function MobilePageError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div role="alert" className="px-4 py-12 text-center">
      <h2 className="text-base font-semibold">页面加载失败</h2>
      <p className="mb-6 mt-2 text-sm text-muted-foreground">请重试，或选择其他菜单。</p>
      <Button disabled={isPending} onClick={() => startTransition(retry)}>
        <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
        {isPending ? '正在重试...' : '重新加载'}
      </Button>
    </div>
  )
}
