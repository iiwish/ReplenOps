'use client'

import { useEffect, useState } from 'react'
import { Alert, Descriptions, Empty, InputNumber, Modal, Spin, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CheckCircleOutlined } from '@ant-design/icons'
import { completeStockOut, getStockOutById } from '@/actions/stock-out-actions'
import type { StockOutDetail } from '@/services/stock-out.service'

interface OrderStockOutModalProps {
  open: boolean
  orderCode?: string
  stockOutId: string | null
  onCancel: () => void
  onCompleted: () => Promise<void>
}

export function OrderStockOutModal({
  open,
  orderCode,
  stockOutId,
  onCancel,
  onCompleted,
}: OrderStockOutModalProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [stockOut, setStockOut] = useState<StockOutDetail | null>(null)
  const [shippedQuantities, setShippedQuantities] = useState<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false

    if (!open || !stockOutId) {
      setStockOut(null)
      setShippedQuantities({})
      return
    }

    setLoading(true)
    void getStockOutById(stockOutId)
      .then((result) => {
        if (cancelled) return

        if (!result.success || !result.data) {
          message.error(result.message || '获取出库单详情失败')
          return
        }

        const detail = result.data as StockOutDetail
        setStockOut(detail)
        setShippedQuantities(
          Object.fromEntries(detail.containers.map((item) => [item.id, item.shippedQuantity]))
        )
      })
      .catch(() => {
        if (!cancelled) message.error('获取出库单详情失败，请重试')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, stockOutId])

  const handleComplete = async () => {
    if (!stockOut || stockOut.status !== 'PENDING') return

    setSubmitting(true)
    try {
      const result = await completeStockOut(stockOut.id, {
        containers: stockOut.containers.map((item) => ({
          itemId: item.id,
          shippedQuantity: shippedQuantities[item.id] ?? item.shippedQuantity,
        })),
      })

      if (!result.success) {
        message.error(result.message || '出库失败')
        return
      }

      message.success(result.message || '出库成功')
      await onCompleted()
    } catch {
      message.error('出库失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const itemColumns: ColumnsType<StockOutDetail['items'][number]> = [
    { title: '商品编码', dataIndex: 'goodsCode', key: 'goodsCode' },
    { title: '商品名称', dataIndex: 'goodsName', key: 'goodsName' },
    { title: '单位', dataIndex: 'goodsUnit', key: 'goodsUnit', width: 80 },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 90, align: 'right' },
    {
      title: '领用金额',
      dataIndex: 'lineAmount',
      key: 'lineAmount',
      width: 110,
      align: 'right',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
  ]

  const containerColumns: ColumnsType<StockOutDetail['containers'][number]> = [
    { title: '包装物', dataIndex: 'containerName', key: 'containerName' },
    { title: '单位', dataIndex: 'containerUnit', key: 'containerUnit', width: 80 },
    {
      title: '建议数量',
      dataIndex: 'expectedQuantity',
      key: 'expectedQuantity',
      width: 100,
      align: 'right',
    },
    {
      title: '实际发出',
      key: 'shippedQuantity',
      width: 150,
      align: 'right',
      render: (_, item) => (
        <InputNumber
          min={0}
          precision={0}
          value={shippedQuantities[item.id] ?? item.shippedQuantity}
          onChange={(value) =>
            setShippedQuantities((current) => ({
              ...current,
              [item.id]: value ?? 0,
            }))
          }
        />
      ),
    },
  ]

  return (
    <Modal
      title={`确认出库${stockOut?.code ? ` ${stockOut.code}` : orderCode ? `（订单 ${orderCode}）` : ''}`}
      open={open}
      onCancel={onCancel}
      onOk={() => void handleComplete()}
      okText="确认出库"
      cancelText="取消"
      confirmLoading={submitting}
      width={920}
      destroyOnClose
      okButtonProps={{
        icon: <CheckCircleOutlined />,
        disabled: loading || !stockOut || stockOut.status !== 'PENDING',
      }}
    >
      {loading ? (
        <div className="py-12 text-center">
          <Spin />
        </div>
      ) : !stockOut ? (
        <Empty description="暂无可用的出库单详情" />
      ) : (
        <div className="space-y-4">
          {stockOut.status !== 'PENDING' && (
            <Alert
              type="warning"
              showIcon
              message={`该出库单当前状态为${stockOut.status === 'COMPLETED' ? '已出库' : '已取消'}，不可重复操作`}
            />
          )}

          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="出库单号">{stockOut.code}</Descriptions.Item>
            <Descriptions.Item label="订单号">{stockOut.orderCode}</Descriptions.Item>
            <Descriptions.Item label="门店">{stockOut.storeName}</Descriptions.Item>
            <Descriptions.Item label="仓库">{stockOut.warehouseName}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={stockOut.status === 'PENDING' ? 'warning' : 'default'}>
                {stockOut.status === 'PENDING' ? '待出库' : stockOut.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="备注">{stockOut.remark || '-'}</Descriptions.Item>
          </Descriptions>

          <section>
            <div className="mb-2 font-medium">商品明细</div>
            <Table
              columns={itemColumns}
              dataSource={stockOut.items}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 560 }}
            />
          </section>

          {stockOut.containers.length > 0 && (
            <section>
              <div className="mb-2 font-medium">包装物明细</div>
              <Table
                columns={containerColumns}
                dataSource={stockOut.containers}
                rowKey="id"
                size="small"
                pagination={false}
                scroll={{ x: 520 }}
              />
            </section>
          )}
        </div>
      )}
    </Modal>
  )
}
