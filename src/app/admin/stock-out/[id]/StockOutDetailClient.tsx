'use client'

import { useState } from 'react'
import Link from 'next/link'
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
  PrinterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { completeStockOut, cancelStockOut } from '@/actions/stock-out-actions'
import type { StockOutDetail } from '@/services/stock-out.service'
import StockOutPrintModal from '@/components/admin/stock-out/StockOutPrintModal'
import { confirmStockOut } from '@/components/admin/stock-out/confirmStockOut'
import dayjs from 'dayjs'

interface StockOutDetailClientProps {
  stockOut: StockOutDetail
  canWriteStock: boolean
}

const statusMap = {
  PENDING: { text: '待出库', color: 'warning', icon: <ExclamationCircleOutlined /> },
  COMPLETED: { text: '已出库', color: 'success', icon: <CheckCircleOutlined /> },
  CANCELLED: { text: '已取消', color: 'default', icon: <CloseCircleOutlined /> },
}

export default function StockOutDetailClient({
  stockOut,
  canWriteStock,
}: StockOutDetailClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [printModalOpen, setPrintModalOpen] = useState(false)

  const handleComplete = () => {
    confirmStockOut({
      stockOutCode: stockOut.code,
      onConfirm: async () => {
        setLoading(true)
        try {
          const result = await completeStockOut(stockOut.id)
          if (result.success) {
            message.success(result.message || '出库成功')
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
            placeholder="请填写取消原因（至少2个字符）"
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
      onOk: (close: () => void) => {
        if (cancelReason.trim().length < 2) {
          message.error('取消原因至少2个字符')
          return
        }

        setLoading(true)
        void (async () => {
          try {
            const result = await cancelStockOut(stockOut.id, { reason: cancelReason })
            if (result.success) {
              close()
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
        })()
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
      title: '领用单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
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
      title: '领用金额',
      dataIndex: 'lineAmount',
      key: 'lineAmount',
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
  ]

  const containerColumns: ColumnsType<StockOutDetail['containers'][number]> = [
    { title: '包装物编码', dataIndex: 'containerCode' },
    { title: '包装物名称', dataIndex: 'containerName' },
    { title: '单位', dataIndex: 'containerUnit', width: 80 },
    { title: '建议数量', dataIndex: 'expectedQuantity', width: 100, align: 'right' },
    { title: '实际发出', dataIndex: 'shippedQuantity', width: 100, align: 'right' },
  ]

  const config = statusMap[stockOut.status as keyof typeof statusMap] ?? {
    text: stockOut.status,
    color: 'default',
    icon: null,
  }
  const totalQuantity = stockOut.items.reduce((sum, item) => sum + item.quantity, 0)
  const totalCostAmount = stockOut.items.reduce((sum, item) => sum + item.costAmount, 0)

  return (
    <div>
      <Space style={{ marginBottom: 16 }} size="middle">
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/admin/stock-out')}>
          返回列表
        </Button>
        {!stockOut.orderIsDeleted && (
          <Link href={`/admin/orders/${stockOut.orderId}`}>
            <Button>查看关联订单</Button>
          </Link>
        )}
        <Button icon={<PrinterOutlined />} onClick={() => setPrintModalOpen(true)}>
          打印出库单
        </Button>
        {canWriteStock && stockOut.status === 'PENDING' && (
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

      <StockOutPrintModal
        open={printModalOpen}
        stockOutId={stockOut.id}
        initialStockOut={stockOut}
        onCancel={() => setPrintModalOpen(false)}
      />

      <Row gutter={16}>
        <Col span={16}>
          <Card title="基本信息">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="出库单号">{stockOut.code}</Descriptions.Item>
              <Descriptions.Item label="订单号">
                {stockOut.orderIsDeleted ? (
                  <Space size={4}>
                    <span>{stockOut.orderCode}</span>
                    <Tag>订单已删除</Tag>
                  </Space>
                ) : (
                  <Link href={`/admin/orders/${stockOut.orderId}`}>{stockOut.orderCode}</Link>
                )}
              </Descriptions.Item>
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
              <Descriptions.Item label="创建人">{stockOut.createdByName}</Descriptions.Item>
              {stockOut.revokedAt && (
                <>
                  <Descriptions.Item label="取消时间">
                    {dayjs(stockOut.revokedAt).format('YYYY-MM-DD HH:mm:ss')}
                  </Descriptions.Item>
                  <Descriptions.Item label="取消人">{stockOut.revokedByName}</Descriptions.Item>
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
                const sumAmount = pageData.reduce((sum, item) => sum + item.lineAmount, 0)
                const sumCostAmount = pageData.reduce((sum, item) => sum + item.costAmount, 0)

                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={4}>
                        <strong>合计</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4} colSpan={2} />
                      <Table.Summary.Cell index={6} align="right">
                        <strong>¥{sumAmount.toFixed(2)}</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={7} align="right">
                        <strong>¥{sumCostAmount.toFixed(2)}</strong>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )
              }}
            />
          </Card>

          {stockOut.containers.length > 0 && (
            <Card title="包装物明细" style={{ marginTop: 16 }}>
              <Table
                columns={containerColumns}
                dataSource={stockOut.containers}
                rowKey="id"
                pagination={false}
              />
            </Card>
          )}
        </Col>

        <Col span={8}>
          <Card title="出库概览" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="出库数量"
                  value={totalQuantity}
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
          </Card>

          {stockOut.status === 'COMPLETED' && (
            <Card title="操作说明" style={{ marginBottom: 16 }}>
              <Alert
                message="发货已完成，等待门店确认收货"
                description="库存已扣减并记录成本。如需撤销，请进入关联订单执行撤销。"
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
                description="此出库单待确认出库，点击确认出库按钮将扣减库存并记录出库成本。"
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
