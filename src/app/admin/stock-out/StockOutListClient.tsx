'use client'

import { useEffect, useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Dayjs } from 'dayjs'
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import {
  AuditOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { completeStockOut, cancelStockOut } from '@/actions/stock-out-actions'
import type { PaginatedStockOutResult } from '@/services/stock-out.service'
import dayjs from 'dayjs'

const { Search } = Input
const { RangePicker } = DatePicker

interface StockOutListClientProps {
  initialData: PaginatedStockOutResult
  warehouses: Array<{ id: string; code: string; name: string }>
  initialFilters: {
    keyword?: string
    status?: string
    warehouseId?: string
    startDate?: string
    endDate?: string
  }
  canReviewOrders: boolean
  canWriteStock: boolean
}

type StockOutRecord = PaginatedStockOutResult['data'][number]

const statusMap = {
  PENDING: { text: '待出库', color: 'warning', icon: <ExclamationCircleOutlined /> },
  COMPLETED: { text: '已出库', color: 'success', icon: <CheckCircleOutlined /> },
  CANCELLED: { text: '已取消', color: 'default', icon: <CloseCircleOutlined /> },
}

export default function StockOutListClient({
  initialData,
  warehouses,
  initialFilters,
  canReviewOrders,
  canWriteStock,
}: StockOutListClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState(initialFilters.keyword ?? '')
  const [selectedStatus, setSelectedStatus] = useState(initialFilters.status)
  const [selectedWarehouse, setSelectedWarehouse] = useState(initialFilters.warehouseId)
  const [dateRange, setDateRange] = useState<[string, string] | null>(
    initialFilters.startDate && initialFilters.endDate
      ? [initialFilters.startDate, initialFilters.endDate]
      : null
  )

  useEffect(() => {
    setSearchKeyword(initialFilters.keyword ?? '')
    setSelectedStatus(initialFilters.status)
    setSelectedWarehouse(initialFilters.warehouseId)
    setDateRange(
      initialFilters.startDate && initialFilters.endDate
        ? [initialFilters.startDate, initialFilters.endDate]
        : null
    )
  }, [initialFilters])

  const handleSearch = (value: string) => {
    setSearchKeyword(value)
    buildUrl({ keyword: value || undefined, page: '1' })
  }

  const handleStatusChange = (value: string | undefined) => {
    setSelectedStatus(value)
    buildUrl({ status: value, page: '1' })
  }

  const handleWarehouseChange = (value: string | undefined) => {
    setSelectedWarehouse(value)
    buildUrl({ warehouseId: value, page: '1' })
  }

  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates?.[0] && dates?.[1]) {
      const range: [string, string] = [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]
      setDateRange(range)
      buildUrl({ startDate: range[0], endDate: range[1], page: '1' })
    } else {
      setDateRange(null)
      buildUrl({ startDate: undefined, endDate: undefined, page: '1' })
    }
  }

  const buildUrl = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const hasUpdate = (key: string) => Object.prototype.hasOwnProperty.call(updates, key)

    const currentKeyword = hasUpdate('keyword') ? updates.keyword : searchKeyword
    const currentStatus = hasUpdate('status') ? updates.status : selectedStatus
    const currentWarehouse = hasUpdate('warehouseId') ? updates.warehouseId : selectedWarehouse
    const currentStartDate = hasUpdate('startDate') ? updates.startDate : dateRange?.[0]
    const currentEndDate = hasUpdate('endDate') ? updates.endDate : dateRange?.[1]
    const currentPage = updates.page ?? String(initialData.page)
    const currentPageSize = updates.pageSize ?? String(initialData.pageSize)

    if (currentKeyword) params.set('keyword', currentKeyword)
    if (currentStatus) params.set('status', currentStatus)
    if (currentWarehouse) params.set('warehouseId', currentWarehouse)
    if (currentStartDate) params.set('startDate', currentStartDate)
    if (currentEndDate) params.set('endDate', currentEndDate)
    if (currentPage !== '1') params.set('page', currentPage)
    if (currentPageSize !== '20') params.set('pageSize', currentPageSize)

    router.push(`/admin/stock-out?${params.toString()}`)
  }

  const handleComplete = (record: StockOutRecord) => {
    Modal.confirm({
      title: '确认出库',
      content: `确定要确认出库单"${record.code}"吗？此操作将扣减库存并记录出库成本。`,
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setLoading(true)
        try {
          const result = await completeStockOut(record.id)
          if (result.success) {
            router.refresh()
            Modal.confirm({
              title: '出库完成',
              content: '库存已扣减。是否立即打印出库单进行复核？',
              okText: '打印出库单',
              cancelText: '稍后打印',
              onOk: () => window.open(`/admin/stock-out/${record.id}/print`, '_blank'),
            })
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

  const handleCancel = (record: StockOutRecord) => {
    let cancelReason = ''
    Modal.confirm({
      title: '取消出库单',
      content: (
        <div>
          <p>确定要取消出库单 &quot;{record.code}&quot; 吗？</p>
          <Input.TextArea
            placeholder="请填写取消原因"
            rows={4}
            onChange={(e) => {
              cancelReason = e.target.value
            }}
          />
        </div>
      ),
      okText: '确认取消',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: (close: () => void) => {
        if (!cancelReason || cancelReason.trim() === '') {
          message.error('请填写取消原因')
          return
        }

        setLoading(true)
        void (async () => {
          try {
            const result = await cancelStockOut(record.id, { reason: cancelReason })
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

  const columns: ColumnsType<StockOutRecord> = [
    {
      title: '出库单号',
      dataIndex: 'code',
      key: 'code',
      width: 150,
      render: (text, record) => (
        <Link className="text-blue-600 hover:underline" href={`/admin/stock-out/${record.id}`}>
          {text}
        </Link>
      ),
    },
    {
      title: '订单号',
      dataIndex: 'orderCode',
      key: 'orderCode',
      width: 150,
      render: (text, record) =>
        record.orderIsDeleted ? (
          <Space size={4}>
            <span>{text}</span>
            <Tag>订单已删除</Tag>
          </Space>
        ) : (
          <Link className="text-blue-600 hover:underline" href={`/admin/orders/${record.orderId}`}>
            {text}
          </Link>
        ),
    },
    {
      title: '门店',
      dataIndex: 'storeName',
      key: 'storeName',
      width: 140,
    },
    {
      title: '仓库',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const config = statusMap[status as keyof typeof statusMap] ?? {
          text: status,
          color: 'default',
          icon: null,
        }
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        )
      },
    },
    {
      title: '成本',
      dataIndex: 'totalCost',
      key: 'totalCost',
      width: 100,
      align: 'right',
      render: (value) => `¥${value.toFixed(2)}`,
    },
    {
      title: '出库数量',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      width: 100,
      align: 'right',
    },
    {
      title: '领用金额',
      dataIndex: 'issueAmount',
      key: 'issueAmount',
      width: 110,
      align: 'right',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 150,
      render: (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => {
        const { status } = record
        return (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => router.push(`/admin/stock-out/${record.id}`)}
            >
              查看
            </Button>
            {canWriteStock && status === 'PENDING' && (
              <>
                <Button
                  type="link"
                  size="small"
                  onClick={() => handleComplete(record)}
                  loading={loading}
                >
                  确认出库
                </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  onClick={() => handleCancel(record)}
                  loading={loading}
                >
                  取消
                </Button>
              </>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Search
              placeholder="搜索单号或订单号"
              allowClear
              value={searchKeyword}
              style={{ width: 200 }}
              onChange={(event) => setSearchKeyword(event.target.value)}
              onSearch={handleSearch}
              enterButton={<SearchOutlined />}
            />
            <Select
              placeholder="选择状态"
              allowClear
              value={selectedStatus}
              style={{ width: 120 }}
              onChange={handleStatusChange}
            >
              <Select.Option value="PENDING">待出库</Select.Option>
              <Select.Option value="COMPLETED">已出库</Select.Option>
              <Select.Option value="CANCELLED">已取消</Select.Option>
            </Select>
            <Select
              placeholder="选择仓库"
              allowClear
              value={selectedWarehouse}
              style={{ width: 150 }}
              onChange={handleWarehouseChange}
            >
              {warehouses.map((wh) => (
                <Select.Option key={wh.id} value={wh.id}>
                  {wh.name}
                </Select.Option>
              ))}
            </Select>
            <RangePicker
              style={{ width: 250 }}
              value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
              onChange={handleDateRangeChange}
              placeholder={['创建日期起', '创建日期止']}
            />
          </div>
          {canReviewOrders && (
            <Link href={'/admin/order-approval' as Route}>
              <Button icon={<AuditOutlined />}>待审批订单</Button>
            </Link>
          )}
        </div>

        <Table
          columns={columns}
          dataSource={initialData.data}
          rowKey="id"
          pagination={{
            current: initialData.page,
            pageSize: initialData.pageSize,
            total: initialData.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              buildUrl({ page: page.toString(), pageSize: pageSize?.toString() })
            },
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="订单审批通过后会自动生成待出库单"
              >
                {canReviewOrders && (
                  <Link href={'/admin/order-approval' as Route}>
                    <Button type="primary">去处理待审批订单</Button>
                  </Link>
                )}
              </Empty>
            ),
          }}
          scroll={{ x: 1500 }}
        />
      </Card>
    </div>
  )
}
