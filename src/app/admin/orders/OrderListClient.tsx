'use client'

import { useState, useEffect } from 'react'
import { Table, Button, message, Card, Space, DatePicker, Select, Input, Tag, Modal } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { getOrders, deleteOrder } from '@/actions/order-actions'
import Link from 'next/link'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Search } = Input
const { Option } = Select

interface OrderItem {
  id: string
  code: string
  storeName: string
  status: string
  totalAmount: number
  remark?: string | null
  createdAt: Date
  createdBy: string
}

// 订单状态配置
const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待审批', color: 'orange' },
  APPROVED: { label: '已审批', color: 'blue' },
  REJECTED: { label: '已拒绝', color: 'red' },
  PROCESSING: { label: '配货中', color: 'cyan' },
  COMPLETED: { label: '已完成', color: 'green' },
  CANCELLED: { label: '已取消', color: 'default' },
}

export function OrderListClient() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<OrderItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  // 筛选条件
  const [filters, setFilters] = useState<{
    status?: string
    storeId?: string
    startDate?: string
    endDate?: string
    keyword?: string
  }>({})

  // 加载数据
  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getOrders({ page, pageSize, ...filters })
      if (res.success && res.data) {
        const resultData = res.data as any
        setData(resultData.data)
        setTotal(resultData.total)
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
      render: (amount: number) => (
        <span className="font-semibold">¥{amount.toFixed(2)}</span>
      ),
    },
    {
      title: '下单时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
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
            <Button type="link" size="small">查看</Button>
          </Link>
          {record.status === 'PENDING' && (
            <>
              <Link href={`/admin/order-approval/${record.id}`}>
                <Button type="link" size="small">审批</Button>
              </Link>
              <Button
                type="link"
                size="small"
                danger
                onClick={() => handleDelete(record)}
              >
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
      {/* 筛选条件 */}
      <Card className="mb-4">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap>
            <span>订单状态:</span>
            <Select
              placeholder="全部状态"
              style={{ width: 150 }}
              allowClear
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
            >
              <Option value="PENDING">待审批</Option>
              <Option value="APPROVED">已审批</Option>
              <Option value="REJECTED">已拒绝</Option>
              <Option value="PROCESSING">配货中</Option>
              <Option value="COMPLETED">已完成</Option>
              <Option value="CANCELLED">已取消</Option>
            </Select>
            <span>日期范围:</span>
            <RangePicker
              value={filters.startDate && filters.endDate ? [dayjs(filters.startDate), dayjs(filters.endDate)] : null}
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
          </Space>
          <Space>
            <Search
              placeholder="搜索订单号或备注"
              allowClear
              style={{ width: 300 }}
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              onSearch={handleFilter}
            />
            <Button type="primary" onClick={handleFilter}>查询</Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>
        </Space>
      </Card>

      {/* 操作按钮 */}
      <div className="mb-4">
        <Space>
          <Button onClick={loadData}>刷新</Button>
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
    </div>
  )
}
