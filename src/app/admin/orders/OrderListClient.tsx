'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Route } from 'next'
import { Button, message, Space, DatePicker, Input, Tag, Tabs, Tooltip, Pagination } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { getOrders } from '@/actions/order-actions'
import Link from 'next/link'
import dayjs from 'dayjs'
import {
  CheckCircleOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  OrderApprovalModal,
  type OrderApprovalResult,
} from '@/components/admin/orders/OrderApprovalModal'
import ActionIconButton from '@/components/admin/ActionIconButton'
import AdminListTable from '@/components/admin/AdminListTable'
import { OrderStockOutModal } from '@/components/admin/orders/OrderStockOutModal'
import { AdminOrderCreateModal } from '@/components/admin/orders/AdminOrderCreateModal'
import type { OrderGoodsOption } from '@/services/goods.service'
import type { StoreOption } from '@/services/store.service'

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
  stockOut: {
    id: string
    code: string
    status: string
  } | null
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

function normalizeFilters(filters: OrderListFilters): OrderListFilters {
  return {
    ...filters,
    keyword: filters.keyword?.trim() || undefined,
  }
}

function filtersMatch(left: OrderListFilters, right: OrderListFilters): boolean {
  return (
    left.status === right.status &&
    left.storeId === right.storeId &&
    left.startDate === right.startDate &&
    left.endDate === right.endDate &&
    left.keyword === right.keyword
  )
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
  canCreateOrders: boolean
  canReviewOrders: boolean
  canWriteStock: boolean
  stores: StoreOption[]
  goods: OrderGoodsOption[]
}

export function OrderListClient({
  initialFilters = {},
  initialApprovalOrderId,
  canCreateOrders,
  canReviewOrders,
  canWriteStock,
  stores,
  goods,
}: OrderListClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<OrderItem[]>([])
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [approvalOrder, setApprovalOrder] = useState<{ id: string; code?: string } | null>(null)
  const [stockOutOrder, setStockOutOrder] = useState<{
    orderCode: string
    stockOutId: string
  } | null>(null)
  const [createOrderOpen, setCreateOrderOpen] = useState(false)
  const requestId = useRef(0)

  // 筛选条件
  const [filters, setFilters] = useState<OrderListFilters>(initialFilters)
  const [draftFilters, setDraftFilters] = useState<OrderListFilters>(initialFilters)

  useEffect(() => {
    if (canReviewOrders && initialApprovalOrderId) {
      setApprovalOrder({ id: initialApprovalOrderId })
    }
  }, [canReviewOrders, initialApprovalOrderId])

  // 加载数据
  const loadData = useCallback(
    async (nextPage = page, nextFilters = filters) => {
      const currentRequestId = ++requestId.current
      setLoading(true)
      try {
        const res = await getOrders({
          page: nextPage,
          pageSize,
          ...nextFilters,
          status: nextFilters.status?.split(','),
        })
        if (currentRequestId !== requestId.current) return

        if (res.success && res.data) {
          const resultData = res.data as OrdersListData
          setData(resultData.data)
          setTotal(resultData.total)
          setStatusCounts(resultData.statusCounts)
        } else {
          message.error(res.message || '加载失败')
        }
      } catch {
        if (currentRequestId === requestId.current) message.error('加载订单失败')
      } finally {
        if (currentRequestId === requestId.current) setLoading(false)
      }
    },
    [filters, page, pageSize]
  )

  useEffect(() => {
    void loadData()
  }, [loadData])

  const syncFiltersToUrl = useCallback(
    (nextFilters: OrderListFilters) => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('approval')
      for (const key of ['status', 'startDate', 'endDate', 'keyword'] as const) {
        const value = nextFilters[key]
        if (value) params.set(key, value)
        else params.delete(key)
      }
      router.replace(`${pathname}${params.size > 0 ? `?${params.toString()}` : ''}` as Route, {
        scroll: false,
      })
    },
    [pathname, router, searchParams]
  )

  // 处理筛选
  const handleFilter = () => {
    const nextFilters = normalizeFilters(draftFilters)
    const shouldReloadDirectly = page === 1 && filtersMatch(filters, nextFilters)
    setPage(1)
    setFilters(nextFilters)
    setDraftFilters(nextFilters)
    syncFiltersToUrl(nextFilters)
    if (shouldReloadDirectly) void loadData(1, nextFilters)
  }

  // 重置筛选
  const handleReset = () => {
    setDraftFilters({})
    setFilters({})
    setPage(1)
    syncFiltersToUrl({})
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
    const nextFilters = { ...filters, status: nextStatus }
    setPage(1)
    setFilters(nextFilters)
    setDraftFilters((current) => ({ ...current, status: nextStatus }))
    syncFiltersToUrl(nextFilters)
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
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Link href={`/admin/orders/${record.id}`}>
            <ActionIconButton type="text" size="small" icon={<EyeOutlined />} tooltip="查看" />
          </Link>
          {record.status === 'PENDING' && canReviewOrders && (
            <ActionIconButton
              type="text"
              size="small"
              icon={<CheckCircleOutlined />}
              tooltip="审批"
              onClick={() => setApprovalOrder({ id: record.id, code: record.code })}
            />
          )}
          {record.status === 'APPROVED' &&
            canWriteStock &&
            record.stockOut?.status === 'PENDING' && (
              <ActionIconButton
                type="text"
                size="small"
                icon={<SendOutlined />}
                tooltip="确认出库"
                onClick={() =>
                  setStockOutOrder({
                    orderCode: record.code,
                    stockOutId: record.stockOut?.id ?? '',
                  })
                }
              />
            )}
        </Space>
      ),
    },
  ]

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <Tabs
        activeKey={filters.status || 'ALL'}
        items={statusTabs}
        onChange={handleStatusChange}
        style={{ flexShrink: 0 }}
      />

      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 border-y border-gray-200 bg-gray-50 px-3 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-sm text-gray-600">日期</span>
            <RangePicker
              style={{ width: 220 }}
              value={
                draftFilters.startDate && draftFilters.endDate
                  ? [dayjs(draftFilters.startDate), dayjs(draftFilters.endDate)]
                  : null
              }
              onChange={(dates) => {
                if (dates) {
                  setDraftFilters({
                    ...draftFilters,
                    startDate: dates[0]?.format('YYYY-MM-DD'),
                    endDate: dates[1]?.format('YYYY-MM-DD'),
                  })
                } else {
                  setDraftFilters({
                    ...draftFilters,
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
            enterButton="查询"
            style={{ width: 230 }}
            value={draftFilters.keyword}
            onChange={(e) => setDraftFilters({ ...draftFilters, keyword: e.target.value })}
            onSearch={handleFilter}
          />
          <Button onClick={handleReset}>重置</Button>
        </div>
        <Space size="small">
          {canCreateOrders && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOrderOpen(true)}>
              新建订单
            </Button>
          )}
          <Tooltip title="刷新订单">
            <Button
              icon={<ReloadOutlined />}
              aria-label="刷新订单"
              loading={loading}
              onClick={() => void loadData()}
            />
          </Tooltip>
        </Space>
      </div>

      {/* 数据表格 */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className="admin-list-table-frame min-h-0 min-w-0 flex-1 overflow-auto"
          style={{ overflow: 'hidden' }}
        >
          <AdminListTable
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1200 }}
            pagination={false}
          />
        </div>
        <div className="flex shrink-0 justify-end border-t border-gray-200 pt-2">
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            size="small"
            showTotal={(total) => `共 ${total} 条`}
            showSizeChanger
            pageSizeOptions={['10', '20', '50', '100']}
            onChange={(nextPage, nextPageSize) => {
              if (nextPageSize !== pageSize) {
                setPageSize(nextPageSize)
                setPage(1)
                return
              }
              setPage(nextPage)
            }}
          />
        </div>
      </div>

      <OrderApprovalModal
        open={Boolean(approvalOrder)}
        orderId={approvalOrder?.id ?? null}
        orderCode={approvalOrder?.code}
        onCancel={closeApproval}
        onCompleted={handleApprovalCompleted}
      />

      <OrderStockOutModal
        open={Boolean(stockOutOrder)}
        orderCode={stockOutOrder?.orderCode}
        stockOutId={stockOutOrder?.stockOutId ?? null}
        onCancel={() => setStockOutOrder(null)}
        onCompleted={async () => {
          setStockOutOrder(null)
          await loadData()
        }}
      />

      {canCreateOrders && (
        <AdminOrderCreateModal
          open={createOrderOpen}
          stores={stores}
          goods={goods}
          onClose={() => setCreateOrderOpen(false)}
          onSuccess={() => {
            setCreateOrderOpen(false)
            if (page === 1) {
              void loadData(1, filters)
            } else {
              setPage(1)
            }
          }}
        />
      )}
    </div>
  )
}
