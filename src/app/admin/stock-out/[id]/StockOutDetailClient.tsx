'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  Descriptions,
  Button,
  Space,
  Table,
  Modal,
  message,
  Tag,
  Row,
  Col,
  Statistic,
  Alert,
  Input,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { completeStockOut, cancelStockOut } from '@/actions/stock-out-actions'
import type { StockOutDetail } from '@/services/stock-out.service'
import dayjs from 'dayjs'

interface StockOutDetailClientProps {
  stockOut: StockOutDetail
}

const statusMap = {
  PENDING: { text: '待出库', color: 'warning', icon: <ExclamationCircleOutlined /> },
  COMPLETED: { text: '已出库', color: 'success', icon: <CheckCircleOutlined /> },
  CANCELLED: { text: '已取消', color: 'default', icon: <CloseCircleOutlined /> },
}

export default function StockOutDetailClient({ stockOut }: StockOutDetailClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleComplete = () => {
    Modal.confirm({
      title: '确认出库',
      content: `确定要确认出库单"${stockOut.code}"吗？此操作将扣减库存并计算利润。`,
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setLoading(true)
        try {
          const result = await completeStockOut(stockOut.id)
          if (result.success) {
            message.success(result.message)
            router.refresh()
          } else {
            message.error(result.message || '出库失败')
          }
        } catch {
          message.error('出库失败，请重试')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  const handleCancel = () => {
    let cancelReason = ''
    Modal.confirm({
      title: '取消出库单',
      content: (
        <div>
          <p>确定要取消出库单 &quot;{stockOut.code}&quot; 吗？</p>
          <Input.TextArea
            placeholder="请填写取消原因"
            rows={4}
            onChange={(e) => {
              cancelReason = (e.target as HTMLTextAreaElement).value
            }}
          />
        </div>
      ),
      okText: '确认取消',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!cancelReason || cancelReason.trim() === '') {
          message.error('请填写取消原因')
        }

        setLoading(true)
        try {
          const result = await cancelStockOut(stockOut.id, { reason: cancelReason })
          if (result.success) {
            message.success(result.message)
            router.refresh()
          } else {
            message.error(result.message || '取消失败')
          }
        } catch {
          message.error('取消失败，请重试')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  const itemsColumns: ColumnsType<StockOutDetail['items'][number]> = [
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
      width: 100,
      align: 'right',
    },
    {
      title: '销售单价',
      dataIndex: 'salePrice',
      key: 'salePrice',
      width: 100,
      align: 'right',
      render: (value) => `¥${value.toFixed(2)}`,
    },
    {
      title: '成本单价(快照)',
      dataIndex: 'snapshotCost',
      key: 'snapshotCost',
      width: 120,
      align: 'right',
      render: (value) => `¥${value.toFixed(2)}`,
    },
    {
      title: '销售金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      align: 'right',
      render: (value) => `¥${value.toFixed(2)}`,
    },
    {
      title: '成本金额',
      dataIndex: 'costAmount',
      key: 'costAmount',
      width: 100,
      align: 'right',
      render: (value) => `¥${value.toFixed(2)}`,
    },
    {
      title: '利润',
      dataIndex: 'profit',
      key: 'profit',
      width: 100,
      align: 'right',
      render: (value) => (
        <span style={{ color: value >= 0 ? 'green' : 'red', fontWeight: 'bold' }}>
          ¥{value.toFixed(2)}
        </span>
      ),
    },
  ]

  const config = statusMap[stockOut.status as keyof typeof statusMap]
  const totalAmount = stockOut.items.reduce((sum, item) => sum + item.amount, 0)
  const totalCostAmount = stockOut.items.reduce((sum, item) => sum + item.costAmount, 0)
  const profitRate = totalAmount > 0 ? (stockOut.totalProfit / totalAmount) * 100 : 0

  return (
    <div>
      <Space style={{ marginBottom: 16 }} size="middle">
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/admin/stock-out')}>
          返回列表
        </Button>
        {stockOut.status === 'PENDING' && (
          <>
            <Button type="primary" onClick={handleComplete} loading={loading} danger>
              确认出库
            </Button>
            <Button onClick={handleCancel} loading={loading}>
              取消
            </Button>
          </>
        )}
      </Space>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="基本信息">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="出库单号">{stockOut.code}</Descriptions.Item>
              <Descriptions.Item label="订单号">{stockOut.orderCode}</Descriptions.Item>
              <Descriptions.Item label="门店名称">{stockOut.storeName}</Descriptions.Item>
              <Descriptions.Item label="仓库名称">{stockOut.warehouseName}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={config.color} icon={config.icon}>
                  {config.text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(stockOut.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="完成时间">
                {stockOut.completedAt
                  ? dayjs(stockOut.completedAt).format('YYYY-MM-DD HH:mm:ss')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建人">{stockOut.createdBy}</Descriptions.Item>
              {stockOut.revokedAt && (
                <>
                  <Descriptions.Item label="取消时间">
                    {dayjs(stockOut.revokedAt).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                  <Descriptions.Item label="取消人">{stockOut.revokedBy}</Descriptions.Item>
                  <Descriptions.Item label="取消原因" span={2}>
                    {stockOut.revokeReason}
                  </Descriptions.Item>
                </>
              )}
              {stockOut.remark && (
                <Descriptions.Item label="备注" span={2}>
                  {stockOut.remark}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          <Card title="商品明细" style={{ marginTop: 16 }}>
            <Table
              columns={itemsColumns}
              dataSource={stockOut.items}
              rowKey="id"
              pagination={false}
              scroll={{ x: 1000 }}
              summary={(pageData) => {
                const sumAmount = pageData.reduce((sum, item) => sum + item.amount, 0)
                const sumCostAmount = pageData.reduce((sum, item) => sum + item.costAmount, 0)
                const sumProfit = pageData.reduce((sum, item) => sum + item.profit, 0)

                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={4}>
                        <strong>合计</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right">
                        <strong>¥{sumAmount.toFixed(2)}</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2} align="right">
                        <strong>¥{sumCostAmount.toFixed(2)}</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right">
                        <strong>¥{sumProfit.toFixed(2)}</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4} align="right" />
                    </Table.Summary.Row>
                  </Table.Summary>
                )
              }}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card title="利润统计" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="销售总额"
                  value={totalAmount}
                  prefix="¥"
                  precision={2}
                  styles={{ content: { color: '#3f8600' } }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="成本总额"
                  value={totalCostAmount}
                  prefix="¥"
                  precision={2}
                  styles={{ content: { color: '#3f8600' } }}
                />
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={12}>
                <Statistic
                  title="利润总额"
                  value={stockOut.totalProfit}
                  prefix="¥"
                  precision={2}
                  styles={{
                    content: { color: stockOut.totalProfit >= 0 ? '#3f8600' : '#cf1322' },
                  }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="利润率"
                  value={profitRate}
                  suffix="%"
                  precision={2}
                  styles={{
                    content: { color: stockOut.totalProfit >= 0 ? '#3f8600' : '#cf1322' },
                  }}
                />
              </Col>
            </Row>
          </Card>

          {stockOut.status === 'COMPLETED' && (
            <Card title="操作说明" style={{ marginBottom: 16 }}>
              <Alert
                message="出库已完成"
                description="此出库单已完成，库存已扣减，利润已计算。"
                type="success"
                showIcon
              />
            </Card>
          )}

          {stockOut.status === 'CANCELLED' && (
            <Card title="操作说明" style={{ marginBottom: 16 }}>
              <Alert
                message="出库已取消"
                description={
                  <div>
                    <p>取消原因: {stockOut.revokeReason}</p>
                    <p>
                      取消时间:{' '}
                      {stockOut.revokedAt
                        ? dayjs(stockOut.revokedAt).format('YYYY-MM-DD HH:mm:ss')
                        : '-'}
                    </p>
                  </div>
                }
                type="warning"
                showIcon
              />
            </Card>
          )}

          {stockOut.status === 'PENDING' && (
            <Card title="操作说明" style={{ marginBottom: 16 }}>
              <Alert
                message="待出库"
                description="此出库单待确认出库，点击确认出库按钮将扣减库存并计算利润。"
                type="info"
                showIcon
              />
            </Card>
          )}
        </Col>
      </Row>
    </div>
  )
}
