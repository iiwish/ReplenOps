'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Descriptions,
  Divider,
  Input,
  message,
  Modal,
  Radio,
  Result,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  approveOrder,
  getOrderDetailWithStock,
  rejectOrder,
} from '@/actions/order-approval-actions'

const { TextArea } = Input
const { Title } = Typography

interface ApprovalOrder {
  id: string
  code: string
  storeName: string
  status: string
  totalAmount: number
  remark: string | null
  createdByName: string
  orderedAt: Date
  warehouseName: string | null
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
    inventoryReserved: boolean
  }>
  containers: Array<{
    containerId: number
    containerCode: string
    containerName: string
    containerUnit: string
    expectedQuantity: number
    sources: Array<{
      goodsId: number
      goodsName: string
      goodsUnit: string
      goodsQuantity: number
      goodsQuantityPerContainer: number
      expectedQuantity: number
    }>
  }>
  canApprove: boolean
}

export interface OrderApprovalResult {
  decision: 'approve' | 'reject'
  stockOutId?: string
}

interface OrderApprovalModalProps {
  open: boolean
  orderId: string | null
  orderCode?: string
  onCancel: () => void
  onCompleted: (result: OrderApprovalResult) => void | Promise<void>
}

export function OrderApprovalModal({
  open,
  orderId,
  orderCode,
  onCancel,
  onCompleted,
}: OrderApprovalModalProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [order, setOrder] = useState<ApprovalOrder | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve')
  const [comment, setComment] = useState('')

  const loadOrder = useCallback(async () => {
    if (!open || !orderId) return

    setLoading(true)
    setLoadError(null)
    setOrder(null)
    setComment('')
    try {
      const response = await getOrderDetailWithStock(orderId)
      if (!response.success || !response.data) {
        setLoadError(response.message || '加载订单失败')
        return
      }

      const nextOrder = response.data as ApprovalOrder
      setOrder(nextOrder)
      setDecision(nextOrder.canApprove ? 'approve' : 'reject')
    } finally {
      setLoading(false)
    }
  }, [open, orderId])

  useEffect(() => {
    void loadOrder()
  }, [loadOrder])

  const handleSubmit = async () => {
    if (!orderId || !order || order.status !== 'PENDING') return

    const normalizedComment = comment.trim()
    if (decision === 'reject' && normalizedComment.length < 5) {
      message.error('拒绝原因至少5个字符')
      return
    }

    setSubmitting(true)
    try {
      const response =
        decision === 'approve'
          ? await approveOrder({ orderId, comment: normalizedComment || undefined })
          : await rejectOrder({ orderId, reason: normalizedComment })

      if (!response.success) {
        message.error(response.message || '审批失败')
        return
      }

      message.success(response.message)
      const responseData = response.data as { stockOutId?: string } | undefined
      await onCompleted({ decision, stockOutId: responseData?.stockOutId })
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnsType<ApprovalOrder['items'][number]> = [
    { title: '商品名称', dataIndex: 'goodsName', key: 'goodsName', width: 180 },
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
      width: 100,
      render: (quantity: number, item) => `${quantity}${item.goodsUnit}`,
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 100,
      align: 'right',
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
    {
      title: '小计',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 110,
      align: 'right',
      render: (price: number) => <span className="font-semibold">¥{price.toFixed(2)}</span>,
    },
    {
      title: '库存状态',
      key: 'stockStatus',
      width: 160,
      render: (_, item) => {
        if (item.inventoryReserved && item.stockStatus !== 'insufficient') {
          return <Tag color="green">已锁定 {item.quantity}</Tag>
        }
        if (item.stockStatus === 'sufficient') {
          return <Tag color="green">充足 {item.availableStock}</Tag>
        }
        if (item.stockStatus === 'tight') {
          return <Tag color="orange">紧张 {item.availableStock}</Tag>
        }
        return <Tag color="red">不足 {item.availableStock}</Tag>
      },
    },
  ]

  const containerColumns: ColumnsType<ApprovalOrder['containers'][number]> = [
    {
      title: '包装物编码',
      dataIndex: 'containerCode',
      key: 'containerCode',
      width: 140,
    },
    {
      title: '包装物名称',
      dataIndex: 'containerName',
      key: 'containerName',
      width: 160,
    },
    {
      title: '预计数量',
      key: 'expectedQuantity',
      width: 120,
      render: (_, container) => `${container.expectedQuantity}${container.containerUnit}`,
    },
    {
      title: '换算明细',
      key: 'sources',
      render: (_, container) => (
        <Space orientation="vertical" size={0}>
          {container.sources.map((source, index) => (
            <span key={`${source.goodsId}-${index}`}>
              {source.goodsName}：{source.goodsQuantity}
              {source.goodsUnit} ÷ {source.goodsQuantityPerContainer}
              {source.goodsUnit}/{container.containerUnit} = {source.expectedQuantity}
              {container.containerUnit}
            </span>
          ))}
        </Space>
      ),
    },
  ]

  const isPending = order?.status === 'PENDING'

  return (
    <Modal
      title={`审批订单${order?.code || orderCode ? ` · ${order?.code || orderCode}` : ''}`}
      open={open}
      width={1000}
      style={{ top: 24, maxWidth: 'calc(100vw - 32px)' }}
      styles={{ body: { maxHeight: 'calc(100vh - 190px)', overflowY: 'auto' } }}
      maskClosable={false}
      keyboard={!submitting}
      closable={!submitting}
      destroyOnHidden
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel} disabled={submitting}>
            取消
          </Button>
          {isPending && order && (
            <Button
              type="primary"
              danger={decision === 'reject'}
              icon={decision === 'approve' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              loading={submitting}
              disabled={decision === 'approve' && !order.canApprove}
              onClick={() => void handleSubmit()}
            >
              {decision === 'approve' ? '通过并生成出库单' : '确认拒绝'}
            </Button>
          )}
        </Space>
      }
    >
      {loading && <Skeleton active paragraph={{ rows: 8 }} />}

      {!loading && loadError && (
        <Result
          status="error"
          title="无法加载审批信息"
          subTitle={loadError}
          extra={<Button onClick={() => void loadOrder()}>重试</Button>}
        />
      )}

      {!loading && order && order.status !== 'PENDING' && (
        <Result
          status="info"
          title="该订单已处理"
          subTitle="订单当前已不是待审批状态，请返回列表刷新查看。"
        />
      )}

      {!loading && order && order.status === 'PENDING' && (
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }}>
            <Descriptions.Item label="门店">{order.storeName}</Descriptions.Item>
            <Descriptions.Item label="下单人">{order.createdByName}</Descriptions.Item>
            <Descriptions.Item label="下单时间">
              {dayjs(order.orderedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="订单金额">
              <strong>¥{order.totalAmount.toFixed(2)}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="出库仓库">
              {order.warehouseName || '暂无可用仓库'}
            </Descriptions.Item>
            <Descriptions.Item label="备注">{order.remark || '-'}</Descriptions.Item>
          </Descriptions>

          <section aria-labelledby="approval-items-heading">
            <Title id="approval-items-heading" level={5} style={{ marginTop: 0 }}>
              商品与库存
            </Title>
            <Table
              size="small"
              columns={columns}
              dataSource={order.items}
              rowKey="id"
              pagination={false}
              scroll={{ x: 820 }}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={4}>
                    <strong>合计</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <strong>¥{order.totalAmount.toFixed(2)}</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} />
                </Table.Summary.Row>
              )}
            />
          </section>

          {order.containers.length > 0 && (
            <section aria-labelledby="approval-containers-heading">
              <Title id="approval-containers-heading" level={5} style={{ marginTop: 0 }}>
                包装物明细
              </Title>
              <Table
                size="small"
                columns={containerColumns}
                dataSource={order.containers}
                rowKey="containerId"
                pagination={false}
                scroll={{ x: 760 }}
              />
            </section>
          )}

          <Divider style={{ margin: 0 }} />

          <section aria-labelledby="approval-decision-heading">
            <Title id="approval-decision-heading" level={5} style={{ marginTop: 0 }}>
              审批决策
            </Title>

            {!order.canApprove && (
              <Alert
                title="库存不足，当前订单不能审批通过"
                description="请先补充库存，或填写原因后拒绝订单。"
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {order.canApprove && decision === 'approve' && (
              <Alert
                title="通过后将自动生成待出库单"
                description={`出库仓库：${order.warehouseName || '未确定'}`}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Radio.Group
              value={decision}
              onChange={(event) => setDecision(event.target.value as 'approve' | 'reject')}
            >
              <Radio.Button value="approve" disabled={!order.canApprove}>
                审批通过
              </Radio.Button>
              <Radio.Button value="reject">审批拒绝</Radio.Button>
            </Radio.Group>

            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 8 }}>
                {decision === 'reject' ? '拒绝原因' : '审批意见'}
                {decision === 'reject' && <span className="text-red-500"> *</span>}
              </div>
              <TextArea
                rows={3}
                value={comment}
                maxLength={500}
                showCount
                placeholder={
                  decision === 'reject' ? '请填写拒绝原因（至少5个字符）' : '可填写审批意见'
                }
                onChange={(event) => setComment(event.target.value)}
              />
            </div>
          </section>
        </Space>
      )}
    </Modal>
  )
}
