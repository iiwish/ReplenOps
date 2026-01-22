'use client'

import { useState, useEffect } from 'react'
import { Table, Button, message, Modal, Card, Space, DatePicker, InputNumber, Input } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { getPendingOrders, batchApproveOrders } from '@/actions/order-approval-actions'
import Link from 'next/link'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Search } = Input

interface OrderItem {
  id: string
  code: string
  storeName: string
  totalAmount: number
  itemCount: number
  createdAt: Date
  remark?: string | null
}

export function ApprovalListClient() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<OrderItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])

  // 筛选条件
  const [filters, setFilters] = useState<{
    startDate?: string
    endDate?: string
    minAmount?: number
    maxAmount?: number
    keyword?: string
  }>({})

  // 加载数据
  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getPendingOrders({ page, pageSize, ...filters })
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

  // 批量审批
  const handleBatchApprove = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要审批的订单')
      return
    }

    Modal.confirm({
      title: '批量审批确认',
      content: `您选中了 ${selectedRowKeys.length} 个订单，确认全部审批通过吗？`,
      onOk: async () => {
        const hide = message.loading('批量审批中...', 0)
        try {
          const res = await batchApproveOrders({ orderIds: selectedRowKeys })
          hide()
          if (res.success) {
            message.success(res.message)
            setSelectedRowKeys([])
            loadData()

            // 显示详细结果
            if (res.data && Array.isArray(res.data)) {
              const failedOrders = res.data.filter((r: any) => !r.success)
              if (failedOrders.length > 0) {
                Modal.info({
                  title: '批量审批结果',
                  content: (
                    <div>
                      <p>成功: {res.data.filter((r: any) => r.success).length}个</p>
                      <p>失败: {failedOrders.length}个</p>
                      <div className="mt-2">
                        {failedOrders.map((item: any) => (
                          <div key={item.orderId} className="text-red-500">
                            {item.orderId}: {item.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                })
              }
            }
          } else {
            message.error(res.message)
          }
        } catch (error) {
          hide()
          message.error('批量审批失败')
        }
      },
    })
  }

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

  const columns: ColumnsType<OrderItem> = [
    {
      title: '订单号',
      dataIndex: 'code',
      key: 'code',
      width: 160,
    },
    {
      title: '门店',
      dataIndex: 'storeName',
      key: 'storeName',
      width: 150,
    },
    {
      title: '下单时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: Date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '商品种类',
      dataIndex: 'itemCount',
      key: 'itemCount',
      width: 100,
      render: (count: number) => `${count}种`,
    },
    {
      title: '订单金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      render: (amount: number) => <span className="font-semibold">¥{amount.toFixed(2)}</span>,
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
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Link href={`/admin/order-approval/${record.id}`}>
          <Button type="link" size="small">
            审批
          </Button>
        </Link>
      ),
    },
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      setSelectedRowKeys(keys as string[])
    },
  }

  return (
    <div>
      {/* 筛选条件 */}
      <Card className="mb-4">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap>
            <span>日期范围:</span>
            <RangePicker
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
            <span>金额范围:</span>
            <InputNumber
              placeholder="最小金额"
              min={0}
              value={filters.minAmount}
              onChange={(value) => setFilters({ ...filters, minAmount: value || undefined })}
            />
            <span>~</span>
            <InputNumber
              placeholder="最大金额"
              min={0}
              value={filters.maxAmount}
              onChange={(value) => setFilters({ ...filters, maxAmount: value || undefined })}
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
            <Button type="primary" onClick={handleFilter}>
              查询
            </Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>
        </Space>
      </Card>

      {/* 操作按钮 */}
      <div className="mb-4">
        <Space>
          <Button
            type="primary"
            onClick={handleBatchApprove}
            disabled={selectedRowKeys.length === 0}
          >
            批量审批 ({selectedRowKeys.length})
          </Button>
          <Button onClick={loadData}>刷新</Button>
        </Space>
      </div>

      {/* 数据表格 */}
      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1000 }}
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
