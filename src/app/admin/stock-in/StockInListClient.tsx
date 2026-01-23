'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Modal,
  message,
  Card,
  Select,
  DatePicker,
} from 'antd'
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  deleteStockIn,
  approveStockIn,
  rejectStockIn,
  completeStockIn,
  cancelStockIn,
} from '@/actions/stock-in-actions'
import type { PaginatedStockInResult } from '@/services/stock-in.service'
import dayjs from 'dayjs'

const { Search } = Input
const { RangePicker } = DatePicker

interface StockInListClientProps {
  initialData: PaginatedStockInResult
  warehouses: Array<{ id: string; code: string; name: string }>
}

type StockInRecord = PaginatedStockInResult['data'][number]

// 状态映射
const statusMap = {
  PENDING: { text: '待审批', color: 'warning', icon: <ClockCircleOutlined /> },
  APPROVED: { text: '已审批', color: 'success', icon: <CheckCircleOutlined /> },
  REJECTED: { text: '已拒绝', color: 'error', icon: <CloseCircleOutlined /> },
  COMPLETED: { text: '已入库', color: 'success', icon: <CheckCircleOutlined /> },
  CANCELLED: { text: '已取消', color: 'default', icon: <ExclamationCircleOutlined /> },
}

export default function StockInListClient({
  initialData,
  warehouses,
}: StockInListClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>()
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>()
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)

  // 搜索处理
  const handleSearch = (value: string) => {
    buildUrl({ keyword: value })
  }

  // 状态筛选处理
  const handleStatusChange = (value: string) => {
    setSelectedStatus(value)
    buildUrl({ status: value })
  }

  // 仓库筛选处理
  const handleWarehouseChange = (value: string) => {
    setSelectedWarehouse(value)
    buildUrl({ warehouseId: value })
  }

  // 日期范围筛选
  const handleDateRangeChange = (dates: any) => {
    if (dates && dates[0] && dates[1]) {
      const range: [string, string] = [
        dates[0].format('YYYY-MM-DD'),
        dates[1].format('YYYY-MM-DD'),
      ]
      setDateRange(range)
      buildUrl({ startDate: range[0], endDate: range[1] })
    } else {
      setDateRange(null)
      buildUrl({ startDate: undefined, endDate: undefined })
    }
  }

  // 构建URL
  const buildUrl = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams()

    const currentKeyword = updates.keyword !== undefined ? updates.keyword : searchKeyword
    const currentStatus = updates.status !== undefined ? updates.status : selectedStatus
    const currentWarehouse = updates.warehouseId !== undefined ? updates.warehouseId : selectedWarehouse
    const currentStartDate = updates.startDate !== undefined ? updates.startDate : dateRange?.[0]
    const currentEndDate = updates.endDate !== undefined ? updates.endDate : dateRange?.[1]

    if (currentKeyword) params.set('keyword', currentKeyword)
    if (currentStatus) params.set('status', currentStatus)
    if (currentWarehouse) params.set('warehouseId', currentWarehouse)
    if (currentStartDate) params.set('startDate', currentStartDate)
    if (currentEndDate) params.set('endDate', currentEndDate)

    router.push(`/admin/stock-in?${params.toString()}`)
  }

  // 审批通过
  const handleApprove = (record: StockInRecord) => {
    Modal.confirm({
      title: '确认审批',
      content: `确定要审批通过入库单"${record.code}"吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true)
        try {
          const result = await approveStockIn(record.id)
          if (result.success) {
            message.success(result.message)
            router.refresh()
          } else {
            message.error(result.message || '审批失败')
          }
        } catch (error) {
          message.error('审批失败，请重试')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  // 审批拒绝
  const handleReject = (record: StockInRecord) => {
    let rejectReason = ''
    Modal.confirm({
      title: '拒绝审批',
      content: (
        <div>
          <p>确定要拒绝入库单"{record.code}"吗？</p>
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
          const result = await rejectStockIn(record.id, rejectReason)
          if (result.success) {
            message.success(result.message)
            router.refresh()
          } else {
            message.error(result.message || '操作失败')
          }
        } catch (error) {
          message.error('操作失败，请重试')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  // 确认入库
  const handleComplete = (record: StockInRecord) => {
    Modal.confirm({
      title: '确认入库',
      content: `确定要将入库单"${record.code}"确认入库吗？入库后将更新库存数量。`,
      okText: '确认入库',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true)
        try {
          const result = await completeStockIn(record.id)
          if (result.success) {
            message.success(result.message)
            router.refresh()
          } else {
            message.error(result.message || '入库失败')
          }
        } catch (error) {
          message.error('入库失败，请重试')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  // 取消入库单
  const handleCancel = (record: StockInRecord) => {
    let cancelReason = ''
    Modal.confirm({
      title: '取消入库单',
      content: (
        <div>
          <p>确定要取消入库单"{record.code}"吗？</p>
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
          const result = await cancelStockIn(record.id, cancelReason)
          if (result.success) {
            message.success(result.message)
            router.refresh()
          } else {
            message.error(result.message || '操作失败')
          }
        } catch (error) {
          message.error('操作失败，请重试')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  // 删除处理
  const handleDelete = (record: StockInRecord) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除入库单"${record.code}"吗？此操作不可恢复。`,
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true)
        try {
          const result = await deleteStockIn(record.id)
          if (result.success) {
            message.success(result.message)
            router.refresh()
          } else {
            message.error(result.message || '删除失败')
          }
        } catch (error) {
          message.error('删除失败，请重试')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  // 表格列定义
  const columns: ColumnsType<StockInRecord> = [
    {
      title: '入库单号',
      dataIndex: 'code',
      key: 'code',
      width: 160,
      fixed: 'left',
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
      render: (status: keyof typeof statusMap) => {
        const config = statusMap[status]
        return (
          <Tag icon={config.icon} color={config.color}>
            {config.text}
          </Tag>
        )
      },
    },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      align: 'right',
      render: (amount: number) => `¥${amount.toFixed(2)}`,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 150,
      ellipsis: true,
      render: (remark: string | null) => remark || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (date: Date) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '审批时间',
      dataIndex: 'approvedAt',
      key: 'approvedAt',
      width: 170,
      render: (date: Date | null) =>
        date ? new Date(date).toLocaleString('zh-CN') : '-',
    },
    {
      title: '入库时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 170,
      render: (date: Date | null) =>
        date ? new Date(date).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/admin/stock-in/${record.id}` as any)}
          >
            查看
          </Button>

          {record.status === 'PENDING' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => router.push(`/admin/stock-in/${record.id}/edit` as any)}
              >
                编辑
              </Button>
              <Button
                type="link"
                size="small"
                onClick={() => handleApprove(record)}
                disabled={loading}
              >
                审批通过
              </Button>
              <Button
                type="link"
                size="small"
                danger
                onClick={() => handleReject(record)}
                disabled={loading}
              >
                拒绝
              </Button>
            </>
          )}

          {record.status === 'APPROVED' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleComplete(record)}
              disabled={loading}
            >
              确认入库
            </Button>
          )}

          {(record.status === 'PENDING' || record.status === 'APPROVED') && (
            <Button
              type="link"
              size="small"
              danger
              onClick={() => handleCancel(record)}
              disabled={loading}
            >
              取消
            </Button>
          )}

          {(record.status === 'REJECTED' || record.status === 'CANCELLED') && (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
              disabled={loading}
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card variant="borderless">
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          {/* 顶部操作栏 */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Space wrap>
              <Select
                placeholder="请选择状态"
                allowClear
                style={{ width: 150 }}
                value={selectedStatus}
                onChange={handleStatusChange}
                options={[
                  { label: '全部状态', value: '' },
                  { label: '待审批', value: 'PENDING' },
                  { label: '已审批', value: 'APPROVED' },
                  { label: '已拒绝', value: 'REJECTED' },
                  { label: '已入库', value: 'COMPLETED' },
                  { label: '已取消', value: 'CANCELLED' },
                ]}
              />
              <Select
                placeholder="请选择仓库"
                allowClear
                style={{ width: 200 }}
                value={selectedWarehouse}
                onChange={handleWarehouseChange}
                options={[
                  { label: '全部仓库', value: '' },
                  ...warehouses.map((warehouse) => ({
                    label: warehouse.name,
                    value: warehouse.id,
                  })),
                ]}
              />
              <RangePicker
                placeholder={['开始日期', '结束日期']}
                onChange={handleDateRangeChange}
                value={
                  dateRange
                    ? [dayjs(dateRange[0]), dayjs(dateRange[1])]
                    : null
                }
              />
              <Search
                placeholder="搜索单号或备注"
                allowClear
                enterButton={<SearchOutlined />}
                style={{ width: 250 }}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onSearch={handleSearch}
              />
            </Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => router.push('/admin/stock-in/new' as any)}
            >
              新增入库单
            </Button>
          </div>

          {/* 表格 */}
          <Table
            columns={columns}
            dataSource={initialData.data}
            rowKey="id"
            loading={loading}
            pagination={{
              current: initialData.page,
              pageSize: initialData.pageSize,
              total: initialData.total,
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page) => {
                const params = new URLSearchParams()
                params.set('page', page.toString())
                if (searchKeyword) params.set('keyword', searchKeyword)
                if (selectedStatus) params.set('status', selectedStatus)
                if (selectedWarehouse) params.set('warehouseId', selectedWarehouse)
                if (dateRange) {
                  params.set('startDate', dateRange[0])
                  params.set('endDate', dateRange[1])
                }
                router.push(`/admin/stock-in?${params.toString()}`)
              },
            }}
            scroll={{ x: 1800 }}
          />
        </Space>
      </Card>
    </div>
  )
}
