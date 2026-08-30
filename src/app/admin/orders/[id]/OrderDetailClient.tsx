'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, Descriptions, Table, Button, message, Tag, Space, Timeline, Result } from 'antd'
import { useRouter } from 'next/navigation'
import { getOrderById } from '@/actions/order-actions'
import { revokeOrder } from '@/actions/order-revocation-actions'
import { RevokeOrderModal } from '@/components/admin/orders/RevokeOrderModal'
import { OrderApprovalModal } from '@/components/admin/orders/OrderApprovalModal'
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
  createdByName: string
  orderedAt: Date
  createdAt: Date
  approvedBy?: string | null
  approvedByName?: string | null
  approvedAt?: Date | null
  completedAt?: Date | null
  stockOut: {
    id: string
    code: string
    status: string
    completedAt: Date | null
  } | null
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

type OrderDetailItem = OrderDetail['items'][number]

// 订单状态配置
const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待审批', color: 'orange' },
  APPROVED: { label: '待出库', color: 'blue' },
  REJECTED: { label: '已拒绝', color: 'red' },
  PROCESSING: { label: '待收货', color: 'cyan' },
  COMPLETED: { label: '已完成', color: 'green' },
  CANCELLED: { label: '已取消', color: 'default' },
}

export function OrderDetailClient({
  orderId,
  canReviewOrders,
}: {
  orderId: string
  canReviewOrders: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showRevokeModal, setShowRevokeModal] = useState(false)
  const [revokeLoading, setRevokeLoading] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getOrderById(orderId)
      if (res.success && res.data) {
        setOrder(res.data as OrderDetail)
      } else {
        const errorMessage = res.message || '加载失败'
        setLoadError(errorMessage)
        message.error(errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载订单失败，请稍后重试'
      setLoadError(errorMessage)
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleRevoke = async (reason: string) => {
    setRevokeLoading(true)
    try {
      const res = await revokeOrder(orderId, { reason })
      if ('success' in res && res.success) {
        message.success('订单撤销成功')
        setShowRevokeModal(false)
        router.push('/admin/orders')
      } else if ('error' in res) {
        message.error(res.error || '撤销失败')
      } else {
        message.error('撤销失败')
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '撤销失败')
    } finally {
      setRevokeLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-gray-500" role="status">
        正在加载订单...
      </div>
    )
  }

  if (!order) {
    return (
      <Result
        status="404"
        title="订单不可用"
        subTitle={loadError || '该订单不存在或已被删除'}
        extra={<Button onClick={() => router.push('/admin/orders')}>返回订单列表</Button>}
      />
    )
  }

  const statusConfig = ORDER_STATUS_CONFIG[order.status] || {
    label: order.status,
    color: 'default',
  }

  const canRevoke = order.status === 'COMPLETED'

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
      render: (qty: number, record: OrderDetailItem) => `${qty}${record.goodsUnit}`,
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
      render: (price: number) => <span className="font-semibold">¥{price.toFixed(2)}</span>,
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
            {dayjs(order.orderedAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="下单人">{order.createdByName}</Descriptions.Item>
          {order.stockOut && (
            <Descriptions.Item label="关联出库单">
              <Link href={`/admin/stock-out/${order.stockOut.id}`}>{order.stockOut.code}</Link>
            </Descriptions.Item>
          )}
          {order.approvedBy && (
            <Descriptions.Item label="审批人">{order.approvedByName}</Descriptions.Item>
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
                  <span className="text-lg font-semibold">¥{order.totalAmount.toFixed(2)}</span>
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
                  <div className="text-sm text-gray-500">
                    {dayjs(order.orderedAt).format('YYYY-MM-DD HH:mm:ss')}
                  </div>
                  <div className="text-sm text-gray-500">创建人: {order.createdByName}</div>
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
                          <div className="text-sm text-gray-500">
                            {dayjs(order.approvedAt).format('YYYY-MM-DD HH:mm:ss')}
                          </div>
                        )}
                        {order.approvedBy && (
                          <div className="text-sm text-gray-500">
                            审批人: {order.approvedByName}
                          </div>
                        )}
                      </div>
                    ),
                  },
                ]
              : []),
            ...(order.stockOut && order.status !== 'REJECTED' && order.status !== 'CANCELLED'
              ? [
                  {
                    color: 'green',
                    children: (
                      <div>
                        <div className="font-semibold">待出库单已生成</div>
                        <div className="text-sm text-gray-500">出库单: {order.stockOut.code}</div>
                      </div>
                    ),
                  },
                ]
              : []),
            ...(order.stockOut?.status === 'COMPLETED'
              ? [
                  {
                    color: 'green',
                    children: (
                      <div>
                        <div className="font-semibold">仓库已发货</div>
                        {order.stockOut.completedAt && (
                          <div className="text-sm text-gray-500">
                            {dayjs(order.stockOut.completedAt).format('YYYY-MM-DD HH:mm:ss')}
                          </div>
                        )}
                      </div>
                    ),
                  },
                ]
              : []),
            ...(order.status === 'COMPLETED'
              ? [
                  {
                    color: 'green',
                    children: (
                      <div>
                        <div className="font-semibold">门店已确认收货</div>
                        {order.completedAt && (
                          <div className="text-sm text-gray-500">
                            {dayjs(order.completedAt).format('YYYY-MM-DD HH:mm:ss')}
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
          {order.status === 'PENDING' && canReviewOrders && (
            <Button type="primary" onClick={() => setShowApprovalModal(true)}>
              审批订单
            </Button>
          )}
          {order.stockOut && (
            <Link href={`/admin/stock-out/${order.stockOut.id}`}>
              <Button>查看出库单</Button>
            </Link>
          )}
          {canRevoke && (
            <Button danger onClick={() => setShowRevokeModal(true)}>
              撤销订单
            </Button>
          )}
        </Space>
      </div>

      {/* 撤销订单弹窗 */}
      <RevokeOrderModal
        visible={showRevokeModal}
        orderId={orderId}
        onConfirm={handleRevoke}
        onCancel={() => setShowRevokeModal(false)}
        loading={revokeLoading}
      />

      <OrderApprovalModal
        open={showApprovalModal}
        orderId={showApprovalModal ? orderId : null}
        orderCode={order.code}
        onCancel={() => setShowApprovalModal(false)}
        onCompleted={async () => {
          setShowApprovalModal(false)
          await loadData()
        }}
      />
    </div>
  )
}
