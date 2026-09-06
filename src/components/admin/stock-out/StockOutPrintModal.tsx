'use client'

import { useEffect, useState } from 'react'
import { Empty, Modal, Spin, message } from 'antd'
import { getStockOutById } from '@/actions/stock-out-actions'
import type { StockOutDetail } from '@/services/stock-out.service'
import StockOutPrintContent from './StockOutPrintContent'

interface StockOutPrintModalProps {
  open: boolean
  stockOutId: string | null
  initialStockOut?: StockOutDetail
  onCancel: () => void
}

export default function StockOutPrintModal({
  open,
  stockOutId,
  initialStockOut,
  onCancel,
}: StockOutPrintModalProps) {
  const [stockOut, setStockOut] = useState<StockOutDetail | null>(null)
  const [fetchedStockOutId, setFetchedStockOutId] = useState<string | null>(null)
  const hasInitialStockOut = initialStockOut?.id === stockOutId
  const isLoading =
    open && Boolean(stockOutId) && !hasInitialStockOut && fetchedStockOutId !== stockOutId
  const displayedStockOut = hasInitialStockOut
    ? initialStockOut
    : stockOut?.id === stockOutId
      ? stockOut
      : null

  useEffect(() => {
    let cancelled = false

    if (!open || !stockOutId || hasInitialStockOut) {
      return
    }

    void getStockOutById(stockOutId)
      .then((result) => {
        if (cancelled) return

        if (!result.success || !result.data) {
          message.error(result.message || '获取出库单详情失败')
          return
        }

        setStockOut(result.data as StockOutDetail)
      })
      .catch(() => {
        if (!cancelled) message.error('获取出库单详情失败，请重试')
      })
      .finally(() => {
        if (!cancelled) setFetchedStockOutId(stockOutId)
      })

    return () => {
      cancelled = true
    }
  }, [hasInitialStockOut, open, stockOutId])

  return (
    <Modal
      title="出库单打印预览"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={900}
      destroyOnHidden
      className="stock-out-print-modal"
      styles={{
        body: {
          maxHeight: 'calc(100vh - 170px)',
          overflowY: 'auto',
          padding: 16,
        },
      }}
    >
      {isLoading ? (
        <div className="py-16 text-center">
          <Spin tip="正在加载打印内容" />
        </div>
      ) : displayedStockOut ? (
        <StockOutPrintContent stockOut={displayedStockOut} />
      ) : (
        <Empty description="暂无可用的出库单详情" />
      )}
    </Modal>
  )
}
