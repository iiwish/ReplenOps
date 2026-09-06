'use client'

import { useCallback, useEffect, useState } from 'react'
import { Table, Button, Modal, message, Segmented, Space, Empty, Tooltip } from 'antd'
import { AuditOutlined, HistoryOutlined, CheckOutlined, StopOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { listTracking, getTrackingLogs } from '@/actions/container-tracking-actions'
import { ContainerReturnList } from '@/components/admin/containers/ContainerReturnList'
import AdminListTable from '@/components/admin/AdminListTable'

interface TrackingItem {
  id: string
  storeId: string
  storeName: string
  containerId: string
  containerName: string
  containerCode: string
  containerUnit: string
  totalBorrowed: number
  totalReturned: number
  currentBorrowed: number
  pendingReturnQuantity: number
  depositTotal: number
  lastBorrowAt: Date | null
  lastReturnAt: Date | null
}

interface LogItem {
  id: string
  containerTrackingId: string
  orderId: string | null
  orderCode: string | null
  opType: string
  quantity: number
  beforeBorrowed: number
  afterBorrowed: number
  remark: string | null
  operatedBy: string
  operatorName: string
  operatedAt: Date
}

export default function ContainerTrackingPage({
  canWriteStock,
  initialHasUnreturned,
  embedded = false,
}: {
  canWriteStock: boolean
  initialHasUnreturned: boolean
  embedded?: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [hasUnreturned, setHasUnreturned] = useState(initialHasUnreturned)
  const [trackingData, setTrackingData] = useState<TrackingItem[]>([])
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [currentLogs, setCurrentLogs] = useState<LogItem[]>([])
  const [review, setReview] = useState<{
    tracking: TrackingItem
    action: 'accept' | 'reject'
  } | null>(null)

  const columns: ColumnsType<TrackingItem> = [
    {
      title: '门店',
      dataIndex: 'storeName',
      key: 'storeName',
    },
    {
      title: '包装物名称',
      key: 'container',
      render: (_value: unknown, record: TrackingItem) => (
        <div>
          <div>{record.containerName}</div>
          <div className="text-xs text-gray-500">{record.containerCode}</div>
        </div>
      ),
    },
    {
      title: '单位',
      dataIndex: 'containerUnit',
      key: 'containerUnit',
    },
    {
      title: '当前在外',
      dataIndex: 'currentBorrowed',
      key: 'currentBorrowed',
      render: (value: number) => (
        <span className={value > 0 ? 'font-bold text-red-500' : ''}>{value}</span>
      ),
    },
    {
      title: '待验收',
      dataIndex: 'pendingReturnQuantity',
      key: 'pendingReturnQuantity',
    },
    {
      title: '押金小计',
      dataIndex: 'depositTotal',
      key: 'depositTotal',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '最后借出',
      dataIndex: 'lastBorrowAt',
      key: 'lastBorrowAt',
      render: (value: Date | null) => (value ? new Date(value).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_value: unknown, record: TrackingItem) => (
        <Space>
          <Tooltip title="查看日志">
            <Button
              type="text"
              size="small"
              aria-label="查看日志"
              icon={<HistoryOutlined />}
              onClick={() => handleShowLogs(record.id)}
            />
          </Tooltip>
          {canWriteStock && record.pendingReturnQuantity > 0 && (
            <>
              <Tooltip title="验收">
                <Button
                  type="text"
                  size="small"
                  aria-label="验收"
                  icon={<CheckOutlined />}
                  onClick={() => setReview({ tracking: record, action: 'accept' })}
                />
              </Tooltip>
              <Tooltip title="驳回">
                <Button
                  type="text"
                  size="small"
                  danger
                  aria-label="驳回"
                  icon={<StopOutlined />}
                  onClick={() => setReview({ tracking: record, action: 'reject' })}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ]

  const logColumns: ColumnsType<LogItem> = [
    {
      title: '操作类型',
      dataIndex: 'opType',
      key: 'opType',
      render: (value: string) =>
        value === 'BORROW' ? '借出' : value === 'RETURN' ? '归还' : value,
    },
    {
      title: '关联订单',
      dataIndex: 'orderCode',
      key: 'orderCode',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: '操作前在外',
      dataIndex: 'beforeBorrowed',
      key: 'beforeBorrowed',
    },
    {
      title: '操作后在外',
      dataIndex: 'afterBorrowed',
      key: 'afterBorrowed',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
    },
    {
      title: '操作人',
      dataIndex: 'operatorName',
      key: 'operatorName',
    },
    {
      title: '操作时间',
      dataIndex: 'operatedAt',
      key: 'operatedAt',
      render: (value: Date) => new Date(value).toLocaleString(),
    },
  ]

  const handleShowLogs = async (trackingId: string) => {
    setLoading(true)
    try {
      const result = await getTrackingLogs(trackingId)
      if (result.success && result.data) {
        setCurrentLogs(result.data as LogItem[])
        setLogModalVisible(true)
      } else {
        message.error(result.message || '加载日志失败')
      }
    } catch {
      message.error('加载日志失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listTracking({ hasUnreturned })
      if (result.success && result.data) {
        setTrackingData(result.data as TrackingItem[])
      } else {
        message.error(result.message || '加载失败')
      }
    } catch {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }, [hasUnreturned])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <div className={embedded ? 'admin-list-page' : 'admin-list-page p-6'}>
      {!embedded && <h1 className="mb-4 shrink-0 text-2xl font-bold">包装物台账查询</h1>}

      {!embedded && (
        <div className="mb-4 flex shrink-0 justify-end gap-2">
          {canWriteStock && (
            <Button
              icon={<AuditOutlined />}
              onClick={() => router.push('/admin/container-return' as Route)}
            >
              归还日志
            </Button>
          )}
          <Segmented
            value={hasUnreturned ? 'unreturned' : 'all'}
            options={[
              { label: '门店台账', value: 'all' },
              { label: '在外包装物', value: 'unreturned' },
            ]}
            onChange={(value) => {
              const nextHasUnreturned = value === 'unreturned'
              setHasUnreturned(nextHasUnreturned)
              router.push(
                (nextHasUnreturned
                  ? '/admin/containers?view=outstanding'
                  : '/admin/containers?view=all') as Route
              )
            }}
          />
        </div>
      )}

      <div className="admin-list-table-frame">
        <AdminListTable
          columns={columns}
          dataSource={trackingData}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={hasUnreturned ? '暂无在外包装物' : '暂无包装物台账'}
              />
            ),
          }}
          scroll={{ x: 900 }}
        />
      </div>

      <Modal
        title={
          review
            ? `${review.tracking.storeName} · ${review.tracking.containerName} · 待验收归还单`
            : '待验收归还单'
        }
        open={Boolean(review)}
        onCancel={() => setReview(null)}
        width={960}
        footer={null}
        destroyOnHidden
      >
        {review && (
          <ContainerReturnList
            key={`${review.tracking.id}-${review.action}`}
            storeId={review.tracking.storeId}
            containerId={review.tracking.containerId}
            canWriteStock={canWriteStock}
            reviewAction={review.action}
            onReviewed={fetchData}
          />
        )}
      </Modal>

      <Modal
        title="包装物变动日志"
        open={logModalVisible}
        onCancel={() => setLogModalVisible(false)}
        width={900}
        footer={null}
      >
        <Table
          columns={logColumns}
          dataSource={currentLogs}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
        />
      </Modal>
    </div>
  )
}
