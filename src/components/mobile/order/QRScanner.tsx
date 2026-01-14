'use client'

import { useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useQRScanner } from '@/hooks/useQRScanner'
import { X } from 'lucide-react'

interface QRScannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (code: string) => void
}

export function QRScanner({ open, onOpenChange, onScan }: QRScannerProps) {
  const { isScanning, error, startScanner, stopScanner } = useQRScanner()

  useEffect(() => {
    if (open) {
      // 延迟启动扫描器，确保 DOM 已渲染
      setTimeout(() => {
        startScanner('qr-reader', (decodedText) => {
          onScan(decodedText)
          onOpenChange(false)
        })
      }, 300)
    } else {
      stopScanner()
    }
  }, [open])

  const handleClose = () => {
    stopScanner()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle>扫描商品条形码</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 flex flex-col items-center justify-center p-4">
          {error ? (
            <div className="text-center space-y-4">
              <div className="text-destructive font-medium">{error}</div>
              <p className="text-sm text-muted-foreground">
                请确保浏览器已授权摄像头权限
              </p>
              <Button onClick={handleClose}>关闭</Button>
            </div>
          ) : (
            <div className="w-full max-w-md space-y-4">
              {/* 扫描器容器 */}
              <div
                id="qr-reader"
                className="w-full rounded-lg overflow-hidden border"
              />

              {isScanning && (
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    请将商品条形码对准扫描框
                  </p>
                  <Button variant="outline" onClick={handleClose}>
                    取消扫描
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
