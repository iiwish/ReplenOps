'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export function useQRScanner() {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  const startScanner = async (
    elementId: string,
    onScanSuccess: (decodedText: string) => void
  ) => {
    try {
      setError(null)

      // 检查是否支持摄像头
      const devices = await Html5Qrcode.getCameras()
      if (devices.length === 0) {
        throw new Error('未检测到摄像头')
      }

      // 创建扫描器实例
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(elementId)
      }

      // 启动扫描
      await scannerRef.current.start(
        { facingMode: 'environment' }, // 使用后置摄像头
        {
          fps: 10, // 每秒扫描帧数
          qrbox: { width: 250, height: 250 }, // 扫描框大小
        },
        (decodedText) => {
          onScanSuccess(decodedText)
        },
        (errorMessage) => {
          // 扫描失败的回调，可以忽略
          console.debug('QR scan error:', errorMessage)
        }
      )

      setIsScanning(true)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '启动扫描失败'
      setError(errorMsg)
      console.error('QR Scanner Error:', err)
    }
  }

  const stopScanner = async () => {
    try {
      if (scannerRef.current && isScanning) {
        await scannerRef.current.stop()
        setIsScanning(false)
      }
    } catch (err) {
      console.error('Stop scanner error:', err)
    }
  }

  // 清理资源
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch((err) => console.error('Cleanup error:', err))
      }
    }
  }, [])

  return {
    isScanning,
    error,
    startScanner,
    stopScanner,
  }
}
