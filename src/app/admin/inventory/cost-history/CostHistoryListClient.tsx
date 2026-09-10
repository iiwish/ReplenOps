'use client'

import type { Route } from 'next'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Select, DatePicker, Modal, Space, Typography, Row, Col, Input } from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { PaginatedCostHistoryResult } from '@/services/cost.service'
import dayjs from 'dayjs'
import Link from 'next/link'
import AdminListTable from '@/components/admin/AdminListTable'

const { RangePicker } = DatePicker
const { Text } = Typography

interface Props {
  initialData: PaginatedCostHistoryResult
  warehouses: Array<{ id: string; name: string }>
  initialFilters: {
    warehouseId?: string
    goodsId?: string
    startDate?: string
    endDate?: string
  }
}

// 关联单据类型配置
const REFERENCE_TYPE_CONFIG: Record<
  string,
  { label: string; getHref: (referenceId: string) => Route }
> = {
  STOCK_IN: { label: '入库单', getHref: (id) => `/admin/stock-in/${id}` as Route },
  STOCK_OUT: { label: '出库单', getHref: (id) => `/admin/stock-out/${id}` as Route },
  ADJUSTMENT: {
    label: '库存调整',
    getHref: () => '/admin/inventory/logs?changeTypes=ADJUSTMENT' as Route,
  },
}

export default function CostHistoryListClient({ initialData, warehouses, initialFilters }: Props) {
  const router = useRouter()
  const [loading, startTransition] = useTransition()
  const [exportModalOpen, setExportModalOpen] = useState(false)

  // 筛选状态
  const [filters, setFilters] = useState({
    warehouseId: initialFilters.warehouseId,
    goodsId: initialFilters.goodsId,
    dateRange:
      initialFilters.startDate && initialFilters.endDate
        ? ([dayjs(initialFilters.startDate), dayjs(initialFilters.endDate)] as [
            dayjs.Dayjs,
            dayjs.Dayjs,
          ])
        : null,
  })

  // 构建查询字符串
  const buildQueryString = (newFilters?: typeof filters) => {
    const params = new URLSearchParams()
    const currentFilters = newFilters || filters

    if (currentFilters.warehouseId) {
      params.set('warehouseId', currentFilters.warehouseId)
    }
    if (currentFilters.goodsId) {
      params.set('goodsId', currentFilters.goodsId)
    }
    if (currentFilters.dateRange) {
      params.set('startDate', currentFilters.dateRange[0].format('YYYY-MM-DD'))
      params.set('endDate', currentFilters.dateRange[1].format('YYYY-MM-DD'))
    } else {
      params.set('dateRange', 'all')
    }

    return params.toString()
  }

  // 变更筛选后立即更新列表，避免额外的确认操作。
  const applyFilters = (nextFilters: typeof filters) => {
    setFilters(nextFilters)
    const query = buildQueryString(nextFilters)
    startTransition(() => {
      router.push(`/admin/inventory/cost-history${query ? `?${query}` : ''}` as Route)
    })
  }

  // 分页处理
  const handlePageChange = (page: number, pageSize?: number) => {
    const params = new URLSearchParams(buildQueryString())
    params.set('page', page.toString())
    if (pageSize) {
      params.set('pageSize', pageSize.toString())
    }
    startTransition(() => {
      router.push(`/admin/inventory/cost-history?${params.toString()}` as Route)
    })
  }

  // 渲染成本变动（带颜色）
  const renderCostChange = (costChange: number, costChangePercent: number) => {
    const isPositive = costChange > 0
    const color = isPositive ? '#ff4d4f' : costChange < 0 ? '#52c41a' : undefined
    const prefix = isPositive ? '+' : ''

    return (
      <Space orientation="vertical" size={0}>
        <Text strong style={{ color }}>
          {prefix}
          {costChange.toFixed(2)} 元
        </Text>
        <Text type="secondary" style={{ fontSize: '12px', color }}>
          {prefix}
          {costChangePercent.toFixed(2)}%
        </Text>
      </Space>
    )
  }

  // 渲染关联单据（可点击跳转）
  const renderReference = (referenceType: string, referenceId: string) => {
    const config = REFERENCE_TYPE_CONFIG[referenceType]
    if (!config) {
      return <Text type="secondary">{referenceType}</Text>
    }

    return (
      <Link href={config.getHref(referenceId)}>
        <Text className="text-blue-600 hover:underline">{config.label}</Text>
      </Link>
    )
  }

  const openExportModal = () => {
    setExportModalOpen(true)
  }

  const confirmExport = () => {
    const query = buildQueryString()
    const link = document.createElement('a')
    link.href = `/api/inventory/cost-history/export${query ? `?${query}` : ''}`
    link.click()
    setExportModalOpen(false)
  }

  const exportDateRangeLabel = filters.dateRange
    ? `${filters.dateRange[0].format('YYYY-MM-DD')} 至 ${filters.dateRange[1].format('YYYY-MM-DD')}`
    : '全部日期'

  // 表格列定义
  const columns: ColumnsType<(typeof initialData.data)[0]> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: Date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '仓库',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      width: 120,
    },
    {
      title: '商品编码',
      dataIndex: 'goodsCode',
      key: 'goodsCode',
      width: 120,
    },
    {
      title: '商品名称',
      dataIndex: 'goodsName',
      key: 'goodsName',
      width: 150,
    },
    {
      title: '变动前成本',
      dataIndex: 'beforeCost',
      key: 'beforeCost',
      width: 120,
      align: 'right',
      render: (cost: number) => `¥${cost.toFixed(2)}`,
    },
    {
      title: '变动后成本',
      dataIndex: 'afterCost',
      key: 'afterCost',
      width: 120,
      align: 'right',
      render: (cost: number) => `¥${cost.toFixed(2)}`,
    },
    {
      title: '成本变动',
      key: 'costChange',
      width: 140,
      align: 'right',
      render: (_, record) => renderCostChange(record.costChange, record.costChangePercent),
    },
    {
      title: '变动前数量',
      dataIndex: 'beforeQty',
      key: 'beforeQty',
      width: 110,
      align: 'right',
      render: (qty: number, record) => `${qty} ${record.goodsUnit}`,
    },
    {
      title: '变动后数量',
      dataIndex: 'afterQty',
      key: 'afterQty',
      width: 110,
      align: 'right',
      render: (qty: number, record) => `${qty} ${record.goodsUnit}`,
    },
    {
      title: '入库数量',
      dataIndex: 'inQty',
      key: 'inQty',
      width: 110,
      align: 'right',
      render: (qty: number, record) => `${qty} ${record.goodsUnit}`,
    },
    {
      title: '入库价格',
      dataIndex: 'inPrice',
      key: 'inPrice',
      width: 110,
      align: 'right',
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
    {
      title: '关联单据',
      key: 'reference',
      width: 120,
      render: (_, record) => renderReference(record.referenceType, record.referenceId),
    },
  ]

  return (
    <div className="admin-list-page p-6">
      <div className="mb-4 border-b border-gray-100 pb-4">
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} sm={12} lg={5}>
            <Select
              aria-label="仓库"
              placeholder="全部仓库"
              allowClear
              style={{ width: '100%' }}
              value={filters.warehouseId}
              onChange={(value) => applyFilters({ ...filters, warehouseId: value })}
              options={warehouses.map((w) => ({
                label: w.name,
                value: w.id,
              }))}
            />
          </Col>
          <Col xs={24} sm={12} lg={5}>
            <Input
              aria-label="商品ID"
              placeholder="请输入商品ID"
              allowClear
              value={filters.goodsId}
              onChange={(e) => applyFilters({ ...filters, goodsId: e.target.value || undefined })}
            />
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <RangePicker
              aria-label="时间范围"
              style={{ width: '100%' }}
              value={filters.dateRange}
              onChange={(dates) =>
                applyFilters({
                  ...filters,
                  dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs] | null,
                })
              }
            />
          </Col>
          <Col xs={24} sm={12} lg={6} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Space>
              <Button type="primary" icon={<FileExcelOutlined />} onClick={openExportModal}>
                导出
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      <div className="admin-list-table-frame">
        <AdminListTable
          columns={columns}
          dataSource={initialData.data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1600 }}
          pagination={{
            current: initialData.page,
            pageSize: initialData.pageSize,
            total: initialData.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: handlePageChange,
          }}
        />
      </div>

      <Modal
        open={exportModalOpen}
        title="确认导出"
        okText="确认导出"
        cancelText="取消"
        onOk={confirmExport}
        onCancel={() => setExportModalOpen(false)}
      >
        <p>
          将导出 <Text strong>{exportDateRangeLabel}</Text> 的成本变动记录，是否继续？
        </p>
      </Modal>
    </div>
  )
}
