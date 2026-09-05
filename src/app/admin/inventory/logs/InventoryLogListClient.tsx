'use client'

import type { Route } from 'next'
import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Card,
  Table,
  Button,
  Select,
  DatePicker,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Tooltip,
} from 'antd'
import {
  FilterOutlined,
  ReloadOutlined,
  FileExcelOutlined,
  EditOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { PaginatedInventoryLogResult } from '@/services/inventory-log.service'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import Link from 'next/link'
import InventoryAdjustmentModal from '@/components/admin/inventory/InventoryAdjustmentModal'

const { RangePicker } = DatePicker
const { Text } = Typography

interface Props {
  initialData: PaginatedInventoryLogResult
  warehouses: Array<{ id: string; name: string }>
  operators: Array<{ id: string; username: string }>
  initialFilters: {
    warehouseId?: string
    goodsId?: string
    changeTypes: string[]
    startDate?: string
    endDate?: string
    operatorId?: string
  }
  canAdjustInventory: boolean
  initialAdjustmentOpen: boolean
}

type InventoryLogRecord = PaginatedInventoryLogResult['data'][number]

// 变动类型配置
const CHANGE_TYPE_CONFIG = {
  IN: { label: '入库', color: 'green' },
  OUT: { label: '出库', color: 'red' },
  RETURN: { label: '退回', color: 'blue' },
  ADJUSTMENT: { label: '调整', color: 'orange' },
}

// 关联单据类型配置
const REFERENCE_TYPE_CONFIG: Record<
  string,
  { label: string; routePrefix: string }
> = {
  STOCK_IN: { label: '入库单', routePrefix: '/admin/stock-in' },
  STOCK_OUT: { label: '出库单', routePrefix: '/admin/stock-out' },
  ORDER: { label: '订单', routePrefix: '/admin/orders' },
  manual_adjustment: { label: '手动调整', routePrefix: '' },
  order_revoke: { label: '订单撤销', routePrefix: '' },
}

export default function InventoryLogListClient({
  initialData,
  warehouses,
  operators,
  initialFilters,
  canAdjustInventory,
  initialAdjustmentOpen,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [adjustmentOpen, setAdjustmentOpen] = useState(false)

  useEffect(() => {
    if (!canAdjustInventory || !initialAdjustmentOpen) return

    const frame = requestAnimationFrame(() => setAdjustmentOpen(true))
    return () => cancelAnimationFrame(frame)
  }, [canAdjustInventory, initialAdjustmentOpen])

  // 筛选状态
  const [filters, setFilters] = useState({
    warehouseId: initialFilters.warehouseId,
    goodsId: initialFilters.goodsId,
    changeTypes: initialFilters.changeTypes,
    dateRange:
      initialFilters.startDate && initialFilters.endDate
        ? ([dayjs(initialFilters.startDate), dayjs(initialFilters.endDate)] as [
            dayjs.Dayjs,
            dayjs.Dayjs,
          ])
        : null,
    operatorId: initialFilters.operatorId,
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
    if (currentFilters.changeTypes.length > 0) {
      params.set('changeTypes', currentFilters.changeTypes.join(','))
    }
    if (currentFilters.dateRange) {
      params.set('startDate', currentFilters.dateRange[0].format('YYYY-MM-DD'))
      params.set('endDate', currentFilters.dateRange[1].format('YYYY-MM-DD'))
    }
    if (currentFilters.operatorId) {
      params.set('operatorId', currentFilters.operatorId)
    }

    return params.toString()
  }

  // 应用筛选
  const handleFilter = () => {
    setLoading(true)
    const query = buildQueryString()
    router.push(`/admin/inventory/logs${query ? `?${query}` : ''}` as Route)
  }

  // 重置筛选
  const handleReset = () => {
    setFilters({
      warehouseId: undefined,
      goodsId: undefined,
      changeTypes: [],
      dateRange: null,
      operatorId: undefined,
    })
    setLoading(true)
    router.push('/admin/inventory/logs' as Route)
  }

  // 刷新
  const handleRefresh = () => {
    setLoading(true)
    router.refresh()
    setTimeout(() => setLoading(false), 500)
  }

  const handleExport = () => {
    const query = buildQueryString()
    const link = document.createElement('a')
    link.href = `/api/inventory/logs/export${query ? `?${query}` : ''}`
    link.click()
  }

  const openAdjustment = () => {
    setAdjustmentOpen(true)
    const params = new URLSearchParams(searchParams.toString())
    params.set('adjustment', '1')
    router.replace(`${pathname}?${params.toString()}` as Route, { scroll: false })
  }

  const closeAdjustment = () => {
    setAdjustmentOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('adjustment')
    router.replace(`${pathname}${params.size > 0 ? `?${params.toString()}` : ''}` as Route, {
      scroll: false,
    })
  }

  const handleAdjustmentCompleted = async () => {
    closeAdjustment()
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
    router.push(`/admin/inventory/logs?${params.toString()}` as Route)
  }

  // 渲染变动数量（带颜色）
  const renderQuantity = (quantity: number) => {
    const isPositive = quantity > 0
    const color = isPositive ? 'green' : quantity < 0 ? 'red' : 'default'
    const prefix = isPositive ? '+' : ''
    return (
      <Text strong style={{ color: color === 'green' ? '#52c41a' : color === 'red' ? '#ff4d4f' : undefined }}>
        {prefix}
        {quantity}
      </Text>
    )
  }

  // 渲染关联单据（可点击跳转）
  const renderReference = (referenceType: string | null, referenceId: string | null) => {
    if (!referenceType || !referenceId) {
      return <Text type="secondary">-</Text>
    }

    const config = REFERENCE_TYPE_CONFIG[referenceType]
    if (!config) {
      return <Text type="secondary">{referenceType}</Text>
    }

    if (!config.routePrefix) {
      return <Tag>{config.label}</Tag>
    }

    return (
      <Link href={`${config.routePrefix}/${referenceId}` as Route}>
        <Tag color="blue" style={{ cursor: 'pointer' }}>
          {config.label}
        </Tag>
      </Link>
    )
  }

  // 表格列定义
  const columns: ColumnsType<InventoryLogRecord> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: Date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '仓库',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      width: 120,
    },
    {
      title: '商品',
      key: 'goods',
      width: 200,
      render: (_value, record) => (
        <div>
          <div>{record.goodsName}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.goodsCode}
          </Text>
        </div>
      ),
    },
    {
      title: '变动类型',
      dataIndex: 'changeType',
      key: 'changeType',
      width: 100,
      render: (type: string) => {
        const config = CHANGE_TYPE_CONFIG[type as keyof typeof CHANGE_TYPE_CONFIG]
        return <Tag color={config?.color}>{config?.label || type}</Tag>
      },
    },
    {
      title: '变动数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right',
      render: renderQuantity,
    },
    {
      title: '变动前',
      dataIndex: 'beforeQty',
      key: 'beforeQty',
      width: 100,
      align: 'right',
    },
    {
      title: '变动后',
      dataIndex: 'afterQty',
      key: 'afterQty',
      width: 100,
      align: 'right',
    },
    {
      title: '关联单据',
      key: 'reference',
      width: 120,
      render: (_, record) =>
        renderReference(record.referenceType, record.referenceId),
    },
    {
      title: '操作人',
      dataIndex: 'operatorName',
      key: 'operatorName',
      width: 100,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 200,
      ellipsis: {
        showTitle: false,
      },
      render: (remark: string | null) =>
        remark ? (
          <Tooltip placement="topLeft" title={remark}>
            {remark}
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ]

  return (
    <div className="p-6">
      <Card
        title="库存流水"
        extra={
          <Space>
            <Button
              icon={<FileExcelOutlined />}
              onClick={handleExport}
            >
              导出
            </Button>
            {canAdjustInventory && (
              <Button type="primary" icon={<EditOutlined />} onClick={openAdjustment}>
                调整库存
              </Button>
            )}
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
          </Space>
        }
      >
        {/* 筛选器 */}
        <Card size="small" title={<><FilterOutlined /> 筛选条件</>} style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <div>
                <div style={{ marginBottom: 4 }}>仓库</div>
                <Select
                  placeholder="选择仓库"
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
            <Col span={6}>
              <div>
                <div style={{ marginBottom: 4 }}>变动类型</div>
                <Select
                  mode="multiple"
                  placeholder="选择变动类型"
                  allowClear
                  style={{ width: '100%' }}
                  value={filters.changeTypes}
                  onChange={(value) =>
                    setFilters({ ...filters, changeTypes: value })
                  }
                  options={Object.entries(CHANGE_TYPE_CONFIG).map(([key, config]) => ({
                    label: config.label,
                    value: key,
                  }))}
                />
              </div>
            </Col>
            <Col span={8}>
              <div>
                <div style={{ marginBottom: 4 }}>时间范围</div>
                <RangePicker
                  style={{ width: '100%' }}
                  value={filters.dateRange}
                  onChange={(dates) =>
                    setFilters({ ...filters, dateRange: dates as [Dayjs, Dayjs] | null })
                  }
                />
              </div>
            </Col>
            <Col span={4}>
              <div>
                <div style={{ marginBottom: 4 }}>操作人</div>
                <Select
                  placeholder="选择操作人"
                  allowClear
                  style={{ width: '100%' }}
                  value={filters.operatorId}
                  onChange={(value) =>
                    setFilters({ ...filters, operatorId: value })
                  }
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={operators.map((op) => ({
                    label: op.username,
                    value: op.id,
                  }))}
                />
              </div>
            </Col>
          </Row>
          <Row style={{ marginTop: 16 }}>
            <Col span={24}>
              <Space>
                <Button type="primary" icon={<FilterOutlined />} onClick={handleFilter}>
                  应用筛选
                </Button>
                <Button onClick={handleReset}>重置</Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 表格 */}
        <Table
          dataSource={initialData.data}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: initialData.page,
            pageSize: initialData.pageSize,
            total: initialData.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: handlePageChange,
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      <InventoryAdjustmentModal
        open={adjustmentOpen}
        warehouses={warehouses}
        onCancel={closeAdjustment}
        onCompleted={handleAdjustmentCompleted}
      />
    </div>
  )
}
