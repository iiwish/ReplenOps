'use client'

import { useCallback, useEffect, useState } from 'react'
import { Table, Button, Modal, message, Segmented, Space } from 'antd'
import { AuditOutlined, ContainerOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { listTracking, getTrackingLogs } from '@/actions/container-tracking-actions'

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
}: {
  canWriteStock: boolean
  initialHasUnreturned: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [hasUnreturned, setHasUnreturned] = useState(initialHasUnreturned)
  const [trackingData, setTrackingData] = useState<TrackingItem[]>([])
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [currentLogs, setCurrentLogs] = useState<LogItem[]>([])

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
      title: '累计借出',
      dataIndex: 'totalBorrowed',
      key: 'totalBorrowed',
    },
    {
      title: '累计归还',
      dataIndex: 'totalReturned',
      key: 'totalReturned',
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
      title: '最后归还',
      dataIndex: 'lastReturnAt',
      key: 'lastReturnAt',
      render: (value: Date | null) => (value ? new Date(value).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_value: unknown, record: TrackingItem) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<ContainerOutlined />}
            onClick={() => handleShowLogs(record.id)}
          >
            查看日志
          </Button>
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
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">包装物台账查询</h1>

      <div className="mb-4 flex justify-end gap-2">
        {canWriteStock && (
          <Button
            icon={<AuditOutlined />}
            onClick={() => router.push('/admin/container-return' as Route)}
          >
            归还验收
          </Button>
        )}
        <Segmented
          value={hasUnreturned ? 'unreturned' : 'all'}
          options={[
            { label: '全部台账', value: 'all' },
            { label: '待归还', value: 'unreturned' },
          ]}
          onChange={(value) => {
            const nextHasUnreturned = value === 'unreturned'
            setHasUnreturned(nextHasUnreturned)
            router.push(
              (nextHasUnreturned
                ? '/admin/container-tracking?hasUnreturned=true'
                : '/admin/container-tracking') as Route
            )
          }}
        />
      </div>

      <Table
        columns={columns}
        dataSource={trackingData}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1200 }}
      />

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
