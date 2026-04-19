'use client'

import { useState } from 'react'
import { Table, Button, Modal, InputNumber, message, Space } from 'antd'
import { ContainerOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  listTracking,
  getTrackingLogs,
  returnContainer,
} from '@/actions/container-tracking-actions'

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
  operatedAt: Date
}

export default function ContainerTrackingPage() {
  const [loading, setLoading] = useState(false)
  const [trackingData, setTrackingData] = useState<TrackingItem[]>([])
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [returnModalVisible, setReturnModalVisible] = useState(false)
  const [currentLogs, setCurrentLogs] = useState<LogItem[]>([])
  const [returnQuantity, setReturnQuantity] = useState<number>(1)
  const [currentTrackingId, setCurrentTrackingId] = useState<string | null>(null)

  const columns: ColumnsType<TrackingItem> = [
    {
      title: '门店',
      dataIndex: 'storeName',
      key: 'storeName',
    },
    {
      title: '包装物名称',
      key: 'container',
      render: (_: any, record: TrackingItem) => (
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
      render: (_: any, record: TrackingItem) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<ContainerOutlined />}
            onClick={() => handleShowLogs(record.id)}
          >
            查看日志
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={() => handleOpenReturnModal(record)}
            disabled={record.currentBorrowed === 0}
          >
            归还
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
      dataIndex: 'operatedBy',
      key: 'operatedBy',
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
      }
    } catch {
      message.error('加载日志失败')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenReturnModal = (record: TrackingItem) => {
    setCurrentTrackingId(record.id)
    setReturnQuantity(record.currentBorrowed)
    setReturnModalVisible(true)
  }

  const handleSubmitReturn = async () => {
    if (!currentTrackingId) return

    setLoading(true)
    try {
      const result = await returnContainer({
        trackingId: currentTrackingId,
        quantity: returnQuantity,
      })
      if (result.success) {
        message.success('归还成功')
        setReturnModalVisible(false)
        fetchData()
      }
    } catch {
      message.error('归还失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const result = await listTracking()
      if (result.success && result.data) {
        setTrackingData(result.data as TrackingItem[])
      }
    } catch {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">包装物台账查询</h1>

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

      <Modal
        title="包装物归还"
        open={returnModalVisible}
        onOk={handleSubmitReturn}
        onCancel={() => setReturnModalVisible(false)}
        confirmLoading={loading}
      >
        <div className="space-y-4">
          <div>
            <span className="text-gray-500">归还数量：</span>
            <InputNumber
              min={1}
              value={returnQuantity}
              onChange={(value) => setReturnQuantity(value || 1)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
