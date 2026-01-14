'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  Table,
  Button,
  Select,
  DatePicker,
  Space,
  Typography,
  Row,
  Col,
  Input,
} from 'antd'
import {
  FilterOutlined,
  ReloadOutlined,
  FileExcelOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { PaginatedCostHistoryResult } from '@/services/cost.service'
import dayjs from 'dayjs'
import Link from 'next/link'

const { RangePicker } = DatePicker
const { Text } = Typography

interface Props {
  initialData: PaginatedCostHistoryResult
  warehouses: Array<{ id: string; name: string }>
}

// 关联单据类型配置
const REFERENCE_TYPE_CONFIG: Record<
  string,
  { label: string; routePrefix: string }
> = {
  STOCK_IN: { label: '入库单', routePrefix: '/admin/stock-in' },
  STOCK_OUT: { label: '出库单', routePrefix: '/admin/stock-out' },
  ADJUSTMENT: { label: '库存调整', routePrefix: '/admin/inventory/adjustment' },
}

export default function CostHistoryListClient({
  initialData,
  warehouses,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // 筛选状态
  const [filters, setFilters] = useState({
    warehouseId: undefined as string | undefined,
    goodsId: undefined as string | undefined,
    dateRange: null as [dayjs.Dayjs, dayjs.Dayjs] | null,
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
    }

    return params.toString()
  }

  // 应用筛选
  const handleFilter = () => {
    setLoading(true)
    const query = buildQueryString()
    router.push(
      `/admin/inventory/cost-history${query ? `?${query}` : ''}` as any
    )
  }

  // 重置筛选
  const handleReset = () => {
    setFilters({
      warehouseId: undefined,
      goodsId: undefined,
      dateRange: null,
    })
    setLoading(true)
    router.push('/admin/inventory/cost-history' as any)
  }

  // 刷新
  const handleRefresh = () => {
    setLoading(true)
    router.refresh()
    setTimeout(() => setLoading(false), 500)
  }

  // 分页处理
  const handlePageChange = (page: number, pageSize?: number) => {
    setLoading(true)
    const params = new URLSearchParams(buildQueryString())
    params.set('page', page.toString())
    if (pageSize) {
      params.set('pageSize', pageSize.toString())
    }
    router.push(`/admin/inventory/cost-history?${params.toString()}` as any)
  }

  // 渲染成本变动（带颜色）
  const renderCostChange = (
    costChange: number,
    costChangePercent: number
  ) => {
    const isPositive = costChange > 0
    const color = isPositive ? '#ff4d4f' : costChange < 0 ? '#52c41a' : undefined
    const prefix = isPositive ? '+' : ''

    return (
      <Space direction="vertical" size={0}>
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

    if (!config.routePrefix) {
      return <Text type="secondary">{config.label}</Text>
    }

    return (
      <Link href={`${config.routePrefix}/${referenceId}`}>
        <Text type="link">{config.label}</Text>
      </Link>
    )
  }

  // 导出功能
  const handleExport = () => {
    // TODO: 实现导出功能
    console.log('导出成本历史')
  }

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
      render: (_, record) =>
        renderCostChange(record.costChange, record.costChangePercent),
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
      render: (_, record) =>
        renderReference(record.referenceType, record.referenceId),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        {/* 标题栏 */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Typography.Title level={4} style={{ margin: 0 }}>
              成本历史
            </Typography.Title>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
                刷新
              </Button>
              <Button
                icon={<FileExcelOutlined />}
                onClick={handleExport}
                type="primary"
              >
                导出
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 筛选栏 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <div>
                <Text style={{ display: 'block', marginBottom: 8 }}>
                  仓库
                </Text>
                <Select
                  placeholder="全部仓库"
                  allowClear
                  style={{ width: '100%' }}
                  value={filters.warehouseId}
                  onChange={(value) =>
                    setFilters({ ...filters, warehouseId: value })
                  }
                  options={warehouses.map((w) => ({
                    label: w.name,
                    value: w.id,
                  }))}
                />
              </div>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <div>
                <Text style={{ display: 'block', marginBottom: 8 }}>
                  商品ID
                </Text>
                <Input
                  placeholder="请输入商品ID"
                  allowClear
                  value={filters.goodsId}
                  onChange={(e) =>
                    setFilters({ ...filters, goodsId: e.target.value || undefined })
                  }
                />
              </div>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <div>
                <Text style={{ display: 'block', marginBottom: 8 }}>
                  时间范围
                </Text>
                <RangePicker
                  style={{ width: '100%' }}
                  value={filters.dateRange}
                  onChange={(dates) =>
                    setFilters({
                      ...filters,
                      dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs] | null,
                    })
                  }
                />
              </div>
            </Col>
            <Col xs={24} sm={12} md={8} lg={6}>
              <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%' }}>
                <Space>
                  <Button
                    type="primary"
                    icon={<FilterOutlined />}
                    onClick={handleFilter}
                  >
                    筛选
                  </Button>
                  <Button onClick={handleReset}>重置</Button>
                </Space>
              </div>
            </Col>
          </Row>
        </Card>

        {/* 数据表格 */}
        <Table
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
      </Card>
    </div>
  )
}
