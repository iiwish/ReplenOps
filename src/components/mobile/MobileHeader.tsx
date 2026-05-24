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
    <header className="sticky top-0 z-40 bg-background border-b">
      <div className="flex items-center justify-between h-14 px-4 safe-area-top">
        {/* 左侧返回按钮 */}
        {showBack ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="min-w-[44px] min-h-[44px]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        ) : (
          <div className="w-11" />
        )}

        {/* 中间标题 */}
        <h1 className="text-lg font-semibold truncate">{title}</h1>

        {/* 右侧菜单按钮 */}
        {showMenu ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenu}
            className="min-w-[44px] min-h-[44px]"
          >
            <MoreVertical className="w-5 h-5" />
          </Button>
        ) : (
          <div className="w-11" />
        )}
      </div>
    </header>
  )
}
