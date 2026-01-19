'use client'

import { useState, useEffect } from 'react'
import { Card, Descriptions, Table, Button, Radio, Input, message, Tag, Alert, Space } from 'antd'
import { useRouter } from 'next/navigation'
import {
  getOrderDetailWithStock,
  approveOrder,
  rejectOrder,
} from '@/actions/order-approval-actions'
import dayjs from 'dayjs'

const { TextArea } = Input

interface OrderDetail {
  id: string
  code: string
  storeName: string
  totalAmount: number
  remark: string | null
  createdBy: string
  createdAt: Date
  items: Array<{
    id: string
    goodsName: string
    goodsSpec: string
    goodsUnit: string
    quantity: number
    unitPrice: number
    totalPrice: number
    availableStock: number
    stockStatus: 'sufficient' | 'tight' | 'insufficient'
  }>
  canApprove: boolean
}

export function ApprovalDetailClient({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve')
  const [comment, setComment] = useState('')

  useEffect(() => {
    loadData()
  }, [orderId])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getOrderDetailWithStock(orderId)
      if (res.success && res.data) {
        setOrder(res.data as OrderDetail)
      } else {
        message.error(res.message || '加载失败')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (decision === 'reject' && comment.length < 5) {
      message.error('拒绝原因至少5个字符')
      return
    }

    setSubmitting(true)
    try {
      const res =
        decision === 'approve'
          ? await approveOrder({ orderId, comment })
          : await rejectOrder({ orderId, reason: comment })

      if (res.success) {
        message.success(res.message)
        router.push('/order-approval')
      } else {
        message.error(res.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !order) {
    return <div>加载中...</div>
  }

  const columns = [
    {
      title: '商品名称',
      dataIndex: 'goodsName',
      key: 'goodsName',
      width: 200,
    },
    {
      title: '规格',
      dataIndex: 'goodsSpec',
      key: 'goodsSpec',
      width: 120,
      render: (spec: string) => spec || '-',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      render: (qty: number, record: any) => `${qty}${record.goodsUnit}`,
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 100,
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
    {
      title: '小计',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 120,
      render: (price: number) => (
        <span className="font-semibold">¥{price.toFixed(2)}</span>
      ),
    },
    {
      title: '库存状态',
      key: 'stockStatus',
      width: 150,
      render: (_: any, record: any) => {
        const { stockStatus, availableStock } = record
        const color =
          stockStatus === 'sufficient'
            ? 'green'
            : stockStatus === 'tight'
            ? 'orange'
            : 'red'
        const text =
          stockStatus === 'sufficient'
            ? `✓ 充足(${availableStock})`
            : stockStatus === 'tight'
            ? `⚠ 紧张(${availableStock})`
            : `✗ 不足(${availableStock})`
        return <Tag color={color}>{text}</Tag>
      },
    },
  ]

  return (
    <div>
      {/* 基本信息 */}
      <Card title="基本信息" className="mb-4">
        <Descriptions column={2}>
          <Descriptions.Item label="订单号">{order.code}</Descriptions.Item>
          <Descriptions.Item label="门店">{order.storeName}</Descriptions.Item>
          <Descriptions.Item label="下单时间">
            {dayjs(order.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="下单人">{order.createdBy}</Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>
            {order.remark || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 商品明细 */}
      <Card title="商品明细" className="mb-4">
        <Table
          columns={columns}
          dataSource={order.items}
          rowKey="id"
          pagination={false}
          scroll={{ x: 900 }}
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4}>
                  <span className="font-semibold">合计</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <span className="font-semibold text-lg">
                    ¥{order.totalAmount.toFixed(2)}
                  </span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      {/* 审批操作 */}
      <Card title="审批操作">
        {!order.canApprove && (
          <Alert
            message="库存不足"
            description="部分商品库存不足，无法审批通过，请先补充库存或拒绝订单"
            type="error"
            showIcon
            className="mb-4"
          />
        )}

        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <div className="mb-2">审批决策:</div>
            <Radio.Group
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
            >
              <Radio value="approve" disabled={!order.canApprove}>
                审批通过
              </Radio>
              <Radio value="reject">审批拒绝</Radio>
            </Radio.Group>
          </div>

          <div>
            <div className="mb-2">
              审批意见{decision === 'reject' && <span className="text-red-500">*</span>}:
            </div>
            <TextArea
              rows={4}
              placeholder={
                decision === 'reject'
                  ? '请填写拒绝原因(至少5个字符)'
                  : '可填写审批意见(可选)'
              }
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div>
            <Space>
              <Button onClick={() => router.back()}>取消</Button>
              <Button
                type="primary"
                onClick={handleSubmit}
                loading={submitting}
              >
                提交审批
              </Button>
            </Space>
          </div>
        </Space>
      </Card>
    </div>
  )
}
