'use client'

import { useState, useEffect } from 'react'
import { Card, Descriptions, Table, Button, message, Tag, Space, Timeline } from 'antd'
import { useRouter } from 'next/navigation'
import { getOrderById } from '@/actions/order-actions'
import dayjs from 'dayjs'
import Link from 'next/link'

interface OrderDetail {
  id: string
  code: string
  storeName: string
  status: string
  totalAmount: number
  remark: string | null
  createdBy: string
  createdAt: Date
  approvedBy?: string | null
  approvedAt?: Date | null
  items: Array<{
    id: string
    goodsCode: string
    goodsName: string
    goodsSpec: string | null
    goodsUnit: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
}

// 订单状态配置
const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待审批', color: 'orange' },
  APPROVED: { label: '已审批', color: 'blue' },
  REJECTED: { label: '已拒绝', color: 'red' },
  PROCESSING: { label: '配货中', color: 'cyan' },
  COMPLETED: { label: '已完成', color: 'green' },
  CANCELLED: { label: '已取消', color: 'default' },
}

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState<OrderDetail | null>(null)

  useEffect(() => {
    loadData()
  }, [orderId])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getOrderById(orderId)
      if (res.success && res.data) {
        setOrder(res.data as OrderDetail)
      } else {
        message.error(res.message || '加载失败')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading || !order) {
    return <div>加载中...</div>
  }

  const statusConfig = ORDER_STATUS_CONFIG[order.status] || { label: order.status, color: 'default' }

  const columns = [
    {
      title: '商品编码',
      dataIndex: 'goodsCode',
      key: 'goodsCode',
      width: 120,
    },
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
      render: (spec: string | null) => spec || '-',
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
  ]

  return (
    <div>
      {/* 基本信息 */}
      <Card title="基本信息" className="mb-4">
        <Descriptions column={2}>
          <Descriptions.Item label="订单号">{order.code}</Descriptions.Item>
          <Descriptions.Item label="订单状态">
            <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="门店">{order.storeName}</Descriptions.Item>
          <Descriptions.Item label="下单时间">
            {dayjs(order.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="下单人">{order.createdBy}</Descriptions.Item>
          {order.approvedBy && (
            <Descriptions.Item label="审批人">{order.approvedBy}</Descriptions.Item>
          )}
          {order.approvedAt && (
            <Descriptions.Item label="审批时间">
              {dayjs(order.approvedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          )}
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
                <Table.Summary.Cell index={0} colSpan={5}>
                  <span className="font-semibold">合计</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <span className="font-semibold text-lg">
                    ¥{order.totalAmount.toFixed(2)}
                  </span>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      {/* 订单流程 */}
      <Card title="订单流程" className="mb-4">
        <Timeline
          items={[
            {
              color: 'green',
              children: (
                <div>
                  <div className="font-semibold">订单创建</div>
                  <div className="text-gray-500 text-sm">
                    {dayjs(order.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                  </div>
                  <div className="text-gray-500 text-sm">创建人: {order.createdBy}</div>
                </div>
              ),
            },
            ...(order.status !== 'PENDING'
              ? [
                  {
                    color: order.status === 'REJECTED' ? 'red' : 'green',
                    children: (
                      <div>
                        <div className="font-semibold">
                          {order.status === 'REJECTED' ? '订单拒绝' : '订单审批'}
                        </div>
                        {order.approvedAt && (
                          <div className="text-gray-500 text-sm">
                            {dayjs(order.approvedAt).format('YYYY-MM-DD HH:mm:ss')}
                          </div>
                        )}
                        {order.approvedBy && (
                          <div className="text-gray-500 text-sm">
                            审批人: {order.approvedBy}
                          </div>
                        )}
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>

      {/* 操作按钮 */}
      <div>
        <Space>
          <Button onClick={() => router.back()}>返回</Button>
          {order.status === 'PENDING' && (
            <Link href={`/admin/order-approval/${order.id}`}>
              <Button type="primary">去审批</Button>
            </Link>
          )}
        </Space>
      </div>
    </div>
  )
}
