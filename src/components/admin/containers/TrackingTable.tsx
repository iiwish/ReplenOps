'use client'

import { useState, useEffect } from 'react'
import { Table, Button, Tag, Badge } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { listTracking } from '@/actions/container-tracking-query-actions'
import type { TrackingItem } from './TrackingSummary'

interface TrackingTableProps {
  storeId?: string
  containerId?: string
  hasUnreturned?: boolean
}

export function TrackingTable({ storeId, containerId, hasUnreturned }: TrackingTableProps) {
  const [data, setData] = useState<TrackingItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const loadData = async (currentPage = page, currentPageSize = pageSize) => {
    setLoading(true)
    try {
      const result = await listTracking({
        storeId,
        containerId,
        hasUnreturned,
        page: currentPage,
        pageSize: currentPageSize,
      })

      if (result.success && result.data) {
        setData(result.data.data)
        setTotal(result.data.total)
      } else {
        console.error('加载台账列表失败:', result.message)
      }
    } catch (error) {
      console.error('加载台账列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    loadData(1, pageSize)
  }

  const getWarningBadge = (level: string) => {
    const config =
      {
        danger: { status: 'error', text: '严重' },
        warning: { status: 'warning', text: '警告' },
        info: { status: 'processing', text: '注意' },
        none: { status: 'success', text: '正常' },
      }[level as keyof typeof config] || config.none
    return <Badge {...config[level]} />
  }

  const columns: ColumnsType<TrackingItem> = [
    {
      title: '门店',
      dataIndex: 'storeName',
      width: 120,
      fixed: 'left',
    },
    {
      title: '包装物',
      dataIndex: 'containerName',
      width: 120,
      fixed: 'left',
    },
    {
      title: '当前在外',
      dataIndex: 'currentBorrowed',
      width: 100,
      fixed: 'left',
      sorter: true,
      render: (val: number, record: TrackingItem) => (
        <Badge status={record.warningLevel === 'danger' ? 'error' : 'default'} text={val} />
      ),
    },
    {
      title: '累计借出',
      dataIndex: 'totalBorrowed',
      width: 100,
      fixed: 'left',
    },
    {
      title: '累计归还',
      dataIndex: 'totalReturned',
      width: 100,
      fixed: 'left',
    },
    {
      title: '归还率',
      dataIndex: 'returnRate',
      width: 100,
      fixed: 'left',
      sorter: true,
      render: (val: number) => {
        const color = val < 60 ? 'red' : val < 80 ? 'orange' : 'green'
        return <span style={{ color }}>{val.toFixed(1)}%</span>
      },
    },
    {
      title: '押金小计',
      dataIndex: 'depositAmount',
      width: 120,
      fixed: 'left',
      render: (val: number) => `¥${val.toFixed(2)}`,
    },
    {
      title: '未归还天数',
      dataIndex: 'daysUnreturned',
      width: 120,
      fixed: 'left',
      render: (val: number) => {
        if (val === 0) return '-'
        const color = val > 60 ? 'red' : val > 30 ? 'orange' : 'default'
        return <Tag color={color}>{val}天</Tag>
      },
    },
    {
      title: '预警',
      dataIndex: 'warningLevel',
      width: 100,
      fixed: 'left',
      render: (_: unknown, record: TrackingItem) => getWarningBadge(record.warningLevel),
    },
    {
      title: '最后借出',
      dataIndex: 'lastBorrowAt',
      width: 160,
      fixed: 'left',
      render: (date: Date | null) => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '最后归还',
      dataIndex: 'lastReturnAt',
      width: 160,
      fixed: 'left',
      render: (date: Date | null) => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
    },
  ]

  useEffect(() => {
    loadData(1, pageSize)
  }, [storeId, containerId, hasUnreturned])

  return (
    <Table
      columns={columns}
      dataSource={data}
      loading={loading}
      rowKey="id"
      pagination={{
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 条`,
        onChange: (newPage, newPageSize) => {
          setPage(newPage)
          setPageSize(newPageSize || 20)
          loadData(newPage, newPageSize || 20)
        },
      }}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>包装物台账</span>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            刷新
          </Button>
        </div>
      }
    />
  )
}
