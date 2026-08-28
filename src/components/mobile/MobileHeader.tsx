'use client'

import { ArrowLeft, MoreVertical } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface MobileHeaderProps {
  title: string
  showBack?: boolean
  showMenu?: boolean
  onBack?: () => void
  onMenu?: () => void
}

export default function MobileHeader({
  title,
  showBack = true,
  showMenu = false,
  onBack,
  onMenu,
}: MobileHeaderProps) {
  const router = useRouter()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      router.back()
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="safe-area-top flex h-14 items-center justify-between px-4">
        {/* 左侧返回按钮 */}
        {showBack ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="min-h-[44px] min-w-[44px]"
            aria-label="返回上一页"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : (
          <div className="w-11" />
        )}

        {/* 中间标题 */}
        <h1 className="truncate text-lg font-semibold">{title}</h1>

        {/* 右侧菜单按钮 */}
        {showMenu ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenu}
            className="min-h-[44px] min-w-[44px]"
            aria-label="更多操作"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        ) : (
          <div className="w-11" />
        )}
      </div>
    </header>
  )
}
