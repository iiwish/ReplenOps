'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { logoutAndRedirect } from '@/lib/auth-client'

export function MobileLogoutButton() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)

    try {
      await logoutAndRedirect()
    } catch (error) {
      console.error('退出登录失败:', error)
      toast({
        title: '退出登录失败',
        description: '请稍后重试',
        variant: 'destructive',
      })
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="destructive"
      className="min-h-[48px] w-full"
      onClick={handleLogout}
      disabled={loading}
    >
      <LogOut className="h-5 w-5" />
      {loading ? '退出中...' : '退出登录'}
    </Button>
  )
}
