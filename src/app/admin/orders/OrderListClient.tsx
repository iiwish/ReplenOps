'use client'

import { useState, useEffect } from 'react'
import type { Route } from 'next'
import { Table, Button, message, Card, Space, DatePicker, Input, Tag, Modal, Tabs } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { getOrders, deleteOrder } from '@/actions/order-actions'
import Link from 'next/link'
import dayjs from 'dayjs'
import {
  CheckCircleOutlined,
  FileExcelOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  OrderApprovalModal,
  type OrderApprovalResult,
} from '@/components/admin/orders/OrderApprovalModal'

const { RangePicker } = DatePicker
const { Search } = Input

interface OrderItem {
  id: string
  code: string
  storeName: string
  status: string
  totalAmount: number
  remark?: string | null
  orderedAt: Date
  createdAt: Date
  createdBy: string
}

interface OrdersListData {
  data: OrderItem[]
  total: number
  statusCounts: Record<string, number>
}

export interface OrderListFilters {
  status?: string
  storeId?: string
  startDate?: string
  endDate?: string
  keyword?: string
}

// 订单状态配置
const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待审批', color: 'orange' },
  APPROVED: { label: '待出库', color: 'blue' },
  REJECTED: { label: '已拒绝', color: 'red' },
  PROCESSING: { label: '待收货', color: 'cyan' },
  COMPLETED: { label: '已完成', color: 'green' },
  CANCELLED: { label: '已取消', color: 'default' },
}

interface OrderListClientProps {
  initialFilters?: OrderListFilters
  initialApprovalOrderId?: string
  canReviewOrders: boolean
}

export function OrderListClient({
  initialFilters = {},
  initialApprovalOrderId,
  canReviewOrders,
}: OrderListClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<OrderItem[]>([])
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [approvalOrder, setApprovalOrder] = useState<{ id: string; code?: string } | null>(null)

  // 筛选条件
  const [filters, setFilters] = useState<OrderListFilters>(initialFilters)

  useEffect(() => {
    if (canReviewOrders && initialApprovalOrderId) {
      setApprovalOrder({ id: initialApprovalOrderId })
    }
  }, [canReviewOrders, initialApprovalOrderId])

  // 加载数据
  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getOrders({
        page,
        pageSize,
        ...filters,
        status: filters.status?.split(','),
      })
      if (res.success && res.data) {
        const resultData = res.data as OrdersListData
        setData(resultData.data)
        setTotal(resultData.total)
        setStatusCounts(resultData.statusCounts)
      } else {
        message.error(res.message || '加载失败')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, filters])

  // 处理筛选
  const handleFilter = () => {
    setPage(1)
    loadData()
  }

  // 重置筛选
  const handleReset = () => {
    setFilters({})
    setPage(1)
  }

  // 删除订单
  const handleDelete = (record: OrderItem) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除订单 ${record.code} 吗？`,
      onOk: async () => {
        const res = await deleteOrder(record.id)
        if (res.success) {
          message.success('删除成功')
          loadData()
        } else {
          message.error(res.message || '删除失败')
        }
      },
    })
  }

  const closeApproval = () => {
    setApprovalOrder(null)
    if (searchParams.has('approval')) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('approval')
      router.replace(`${pathname}${params.size > 0 ? `?${params.toString()}` : ''}` as Route, {
        scroll: false,
      })
    }
  }

  const handleApprovalCompleted = async (_result: OrderApprovalResult) => {
    closeApproval()
    await loadData()
  }

  const countFor = (...statuses: string[]) =>
    statuses.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0)

  const handleStatusChange = (status: string) => {
    const nextStatus = status === 'ALL' ? undefined : status
    setPage(1)
    setFilters((current) => ({ ...current, status: nextStatus }))

    const params = new URLSearchParams(searchParams.toString())
    params.delete('approval')
    if (nextStatus) {
      params.set('status', nextStatus)
    } else {
      params.delete('status')
    }
    router.replace(`${pathname}${params.size > 0 ? `?${params.toString()}` : ''}` as Route, {
      scroll: false,
    })
  }

  const statusTabs = [
    { key: 'ALL', label: `全部 ${countFor(...Object.keys(ORDER_STATUS_CONFIG))}` },
    {
      key: 'PENDING,APPROVED,PROCESSING',
      label: `全部待处理 ${countFor('PENDING', 'APPROVED', 'PROCESSING')}`,
    },
    { key: 'PENDING', label: `待审批 ${countFor('PENDING')}` },
    { key: 'APPROVED', label: `待出库 ${countFor('APPROVED')}` },
    { key: 'PROCESSING', label: `待收货 ${countFor('PROCESSING')}` },
    { key: 'COMPLETED', label: `已完成 ${countFor('COMPLETED')}` },
    { key: 'REJECTED', label: `已拒绝 ${countFor('REJECTED')}` },
    { key: 'CANCELLED', label: `已取消 ${countFor('CANCELLED')}` },
  ]

  const columns: ColumnsType<OrderItem> = [
    {
      title: '订单号',
      dataIndex: 'code',
      key: 'code',
      width: 160,
      render: (code: string, record) => (
        <Link href={`/admin/orders/${record.id}`}>
          <span className="text-blue-600 hover:underline">{code}</span>
        </Link>
      ),
    },
    {
      title: '门店',
      dataIndex: 'storeName',
      key: 'storeName',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config = ORDER_STATUS_CONFIG[status] || { label: status, color: 'default' }
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    {
      title: '订单金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      render: (amount: number) => <span className="font-semibold">¥{amount.toFixed(2)}</span>,
    },
    {
      title: '下单时间',
      dataIndex: 'orderedAt',
      key: 'orderedAt',
      width: 180,
      render: (date: Date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      render: (remark: string | null) => remark || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Link href={`/admin/orders/${record.id}`}>
            <Button type="link" size="small">
              查看
            </Button>
          </Link>
          {record.status === 'PENDING' && canReviewOrders && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => setApprovalOrder({ id: record.id, code: record.code })}
              >
                审批
              </Button>
              <Button type="link" size="small" danger onClick={() => handleDelete(record)}>
                删除
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Tabs activeKey={filters.status || 'ALL'} items={statusTabs} onChange={handleStatusChange} />

      {/* 筛选条件 */}
      <Card size="small" className="mb-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-sm text-gray-600">日期</span>
            <RangePicker
              style={{ width: 220 }}
              value={
                filters.startDate && filters.endDate
                  ? [dayjs(filters.startDate), dayjs(filters.endDate)]
                  : null
              }
              onChange={(dates) => {
                if (dates) {
                  setFilters({
                    ...filters,
                    startDate: dates[0]?.format('YYYY-MM-DD'),
                    endDate: dates[1]?.format('YYYY-MM-DD'),
                  })
                } else {
                  setFilters({
                    ...filters,
                    startDate: undefined,
                    endDate: undefined,
                  })
                }
              }}
            />
          </div>
          <Search
            placeholder="搜索订单号或备注"
            allowClear
            style={{ width: 230 }}
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            onSearch={handleFilter}
          />
          <Space size="small">
            <Button type="primary" icon={<SearchOutlined />} onClick={handleFilter}>
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Space>
        </div>
      </Card>

      {/* 操作按钮 */}
      <div className="mb-4">
        <Space>
          <Button onClick={loadData}>刷新</Button>
          <Link href={'/admin/reports/stock-out' as Route}>
            <Button icon={<FileExcelOutlined />}>月度出库报表</Button>
          </Link>
        </Space>
      </div>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showTotal: (total) => `共 ${total} 条`,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
        }}
      />

      <OrderApprovalModal
        open={Boolean(approvalOrder)}
        orderId={approvalOrder?.id ?? null}
        orderCode={approvalOrder?.code}
        onCancel={closeApproval}
        onCompleted={handleApprovalCompleted}
      />
    </div>
  )
}
