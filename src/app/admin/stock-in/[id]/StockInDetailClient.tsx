'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  Descriptions,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  message,
  Input,
  Timeline,
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  approveStockIn,
  rejectStockIn,
  completeStockIn,
  cancelStockIn,
} from '@/actions/stock-in-actions'
import type { StockInDetail } from '@/services/stock-in.service'

interface StockInDetailClientProps {
  data: StockInDetail
}

// 状态映射
const statusMap = {
  PENDING: { text: '待审批', color: 'warning', icon: <ClockCircleOutlined /> },
  APPROVED: {
    text: '已审批',
    color: 'success',
    icon: <CheckCircleOutlined />,
  },
  REJECTED: { text: '已拒绝', color: 'error', icon: <CloseCircleOutlined /> },
  COMPLETED: {
    text: '已入库',
    color: 'success',
    icon: <CheckCircleOutlined />,
  },
  CANCELLED: {
    text: '已取消',
    color: 'default',
    icon: <ExclamationCircleOutlined />,
  },
}

export default function StockInDetailClient({
  data,
}: StockInDetailClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // 审批通过
  const handleApprove = () => {
    Modal.confirm({
      title: '确认审批',
      content: `确定要审批通过入库单"${data.code}"吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true)
        try {
          const result = await approveStockIn(data.id)
          if (result.success) {
            message.success(result.message)
            router.refresh()
          } else {
            message.error(result.message || '审批失败')
          }
        } catch {
          message.error('审批失败，请重试')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  // 审批拒绝
  const handleReject = () => {
    let rejectReason = ''
    Modal.confirm({
      title: '拒绝审批',
      content: (
        <div>
          <p>确定要拒绝入库单 &quot;{data.code}&quot; 吗？</p>
          <Input.TextArea
            placeholder="请填写拒绝原因"
            rows={4}
            onChange={(e) => (rejectReason = e.target.value)}
          />
        </div>
      ),
      okText: '确认拒绝',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        if (!rejectReason.trim()) {
          message.error('请填写拒绝原因')
          return Promise.reject()
        }
        setLoading(true)
        try {
          const result = await rejectStockIn(data.id, rejectReason)
          if (result.success) {
            message.success(result.message)
            router.refresh()
          } else {
            message.error(result.message || '操作失败')
          }
        } catch {
          message.error('操作失败，请重试')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  // 确认入库
  const handleComplete = () => {
    Modal.confirm({
      title: '确认入库',
        content: `确定要将入库单 "${data.code}" 确认入库吗？入库后将更新库存数量。`,
      okText: '确认入库',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true)
        try {
          const result = await completeStockIn(data.id)
          if (result.success) {
            message.success(result.message)
            router.refresh()
          } else {
            message.error(result.message || '入库失败')
          }
        } catch {
          message.error('入库失败，请重试')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  // 取消入库单
  const handleCancel = () => {
    let cancelReason = ''
    Modal.confirm({
      title: '取消入库单',
      content: (
        <div>
          <p>确定要取消入库单 &quot;{data.code}&quot; 吗？</p>
          <Input.TextArea
            placeholder="请填写取消原因"
            rows={4}
            onChange={(e) => (cancelReason = e.target.value)}
          />
        </div>
      ),
      okText: '确认取消',
      okType: 'danger',
      cancelText: '返回',
      onOk: async () => {
        if (!cancelReason.trim()) {
          message.error('请填写取消原因')
          return Promise.reject()
        }
        setLoading(true)
        try {
          const result = await cancelStockIn(data.id, cancelReason)
          if (result.success) {
            message.success(result.message)
            router.refresh()
          } else {
            message.error(result.message || '操作失败')
          }
        } catch {
          message.error('操作失败，请重试')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  // 商品明细表格列定义
  const itemColumns: ColumnsType<StockInDetail['items'][number]> = [
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
      title: '单位',
      dataIndex: 'goodsUnit',
      key: 'goodsUnit',
      width: 80,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      align: 'right',
      render: (quantity: number, record) =>
        record.measureType === 'INT'
          ? quantity.toFixed(0)
          : quantity.toFixed(3),
    },
    {
      title: '单价（元）',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 120,
      align: 'right',
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
    {
      title: '金额（元）',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 120,
      align: 'right',
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
  ]

  // 构建时间线数据
  const timelineItems = []

  timelineItems.push({
    color: 'blue',
    children: (
      <>
        <p>
          <strong>创建入库单</strong>
        </p>
        <p style={{ color: '#999', fontSize: 12 }}>
          {new Date(data.createdAt).toLocaleString('zh-CN')}
        </p>
      </>
    ),
  })

  if (data.approvedAt) {
    timelineItems.push({
      color: 'green',
      children: (
        <>
          <p>
            <strong>审批通过</strong>
          </p>
          <p style={{ color: '#999', fontSize: 12 }}>
            {new Date(data.approvedAt).toLocaleString('zh-CN')}
          </p>
        </>
      ),
    })
  }

  if (data.completedAt) {
    timelineItems.push({
      color: 'green',
      children: (
        <>
          <p>
            <strong>确认入库</strong>
          </p>
          <p style={{ color: '#999', fontSize: 12 }}>
            {new Date(data.completedAt).toLocaleString('zh-CN')}
          </p>
        </>
      ),
    })
  }

  const statusConfig = statusMap[data.status as keyof typeof statusMap]

  return (
    <div>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        {/* 头部操作栏 */}
        <Card variant="borderless">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => router.back()}
                style={{ marginRight: 16 }}
              >
                返回
              </Button>
              <span style={{ fontSize: 20, fontWeight: 'bold' }}>
                入库单详情
              </span>
            </div>
            <Space>
              {data.status === 'PENDING' && (
                <>
                  <Button
                    type="default"
                    icon={<EditOutlined />}
                    onClick={() =>
                      router.push(`/admin/stock-in/${data.id}/edit`)
                    }
                  >
                    编辑
                  </Button>
                  <Button
                    type="primary"
                    onClick={handleApprove}
                    loading={loading}
                  >
                    审批通过
                  </Button>
                  <Button danger onClick={handleReject} loading={loading}>
                    拒绝
                  </Button>
                </>
              )}

              {data.status === 'APPROVED' && (
                <Button
                  type="primary"
                  onClick={handleComplete}
                  loading={loading}
                >
                  确认入库
                </Button>
              )}

              {(data.status === 'PENDING' || data.status === 'APPROVED') && (
                <Button danger onClick={handleCancel} loading={loading}>
                  取消
                </Button>
              )}
            </Space>
          </div>
        </Card>

        {/* 基本信息 */}
        <Card title="基本信息" variant="borderless">
          <Descriptions column={2}>
            <Descriptions.Item label="入库单号">
              {data.code}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag icon={statusConfig.icon} color={statusConfig.color}>
                {statusConfig.text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="仓库">
              {data.warehouseName}
            </Descriptions.Item>
            <Descriptions.Item label="总金额">
              <span style={{ fontSize: 16, fontWeight: 'bold', color: '#ff4d4f' }}>
                ¥{data.totalAmount.toFixed(2)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(data.createdAt).toLocaleString('zh-CN')}
            </Descriptions.Item>
            {data.approvedAt && (
              <Descriptions.Item label="审批时间">
                {new Date(data.approvedAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
            )}
            {data.completedAt && (
              <Descriptions.Item label="入库时间">
                {new Date(data.completedAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
            )}
            {data.remark && (
              <Descriptions.Item label="备注" span={2}>
                {data.remark}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {/* 商品明细 */}
        <Card title="商品明细" variant="borderless">
          <Table
            columns={itemColumns}
            dataSource={data.items}
            rowKey="id"
            pagination={false}
            scroll={{ x: 800 }}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5} align="right">
                  <strong>总金额：</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <strong style={{ fontSize: 16, color: '#ff4d4f' }}>
                    ¥{data.totalAmount.toFixed(2)}
                  </strong>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
        </Card>

        {/* 状态流转记录 */}
        <Card title="状态流转记录" variant="borderless">
          <Timeline items={timelineItems} />
        </Card>
      </Space>
    </div>
  )
}
