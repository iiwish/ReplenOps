'use client'

import type { Route } from 'next'
import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Button,
  Select,
  DatePicker,
  Modal,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Tooltip,
} from 'antd'
import {
  FileExcelOutlined,
  EditOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { PaginatedInventoryLogResult } from '@/services/inventory-log.service'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import Link from 'next/link'
import InventoryAdjustmentModal from '@/components/admin/inventory/InventoryAdjustmentModal'
import AdminListTable from '@/components/admin/AdminListTable'

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
  const [loading, startTransition] = useTransition()
  const [adjustmentOpen, setAdjustmentOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)

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
    } else {
      params.set('dateRange', 'all')
    }
    if (currentFilters.operatorId) {
      params.set('operatorId', currentFilters.operatorId)
    }

    return params.toString()
  }

  // 变更筛选后立即更新列表，避免额外的确认操作。
  const applyFilters = (nextFilters: typeof filters) => {
    setFilters(nextFilters)
    const query = buildQueryString(nextFilters)
    startTransition(() => {
      router.push(`/admin/inventory/logs${query ? `?${query}` : ''}` as Route)
    })
  }

  const openExportModal = () => {
    setExportModalOpen(true)
  }

  const confirmExport = () => {
    const query = buildQueryString()
    const link = document.createElement('a')
    link.href = `/api/inventory/logs/export${query ? `?${query}` : ''}`
    link.click()
    setExportModalOpen(false)
  }

  const exportDateRangeLabel = filters.dateRange
    ? `${filters.dateRange[0].format('YYYY-MM-DD')} 至 ${filters.dateRange[1].format('YYYY-MM-DD')}`
    : '全部日期'

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
    startTransition(() => {
      closeAdjustment()
      router.refresh()
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
      router.push(`/admin/inventory/logs?${params.toString()}` as Route)
    })
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
    <div className="admin-list-page p-6">
      <div className="mb-4 border-b border-gray-100 pb-4">
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} sm={12} lg={4}>
            <Select
              aria-label="仓库"
              placeholder="选择仓库"
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
          <Col xs={24} sm={12} lg={4}>
            <Select
              aria-label="变动类型"
              mode="multiple"
              placeholder="选择变动类型"
              allowClear
              style={{ width: '100%' }}
              value={filters.changeTypes}
              onChange={(value) => applyFilters({ ...filters, changeTypes: value })}
              options={Object.entries(CHANGE_TYPE_CONFIG).map(([key, config]) => ({
                label: config.label,
                value: key,
              }))}
            />
          </Col>
          <Col xs={24} sm={12} lg={7}>
            <RangePicker
              aria-label="时间范围"
              style={{ width: '100%' }}
              value={filters.dateRange}
              onChange={(dates) =>
                applyFilters({
                  ...filters,
                  dateRange: dates as [Dayjs, Dayjs] | null,
                })
              }
            />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Select
              aria-label="操作人"
              placeholder="选择操作人"
              allowClear
              style={{ width: '100%' }}
              value={filters.operatorId}
              onChange={(value) => applyFilters({ ...filters, operatorId: value })}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={operators.map((op) => ({
                label: op.username,
                value: op.id,
              }))}
            />
          </Col>
          <Col
            xs={24}
            sm={24}
            lg={5}
            style={{ display: 'flex', justifyContent: 'flex-end' }}
          >
            <Space wrap>
              <Button type="primary" icon={<FileExcelOutlined />} onClick={openExportModal}>
                导出
              </Button>
              {canAdjustInventory && (
                <Button type="primary" icon={<EditOutlined />} onClick={openAdjustment}>
                  调整库存
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </div>

        {/* 表格 */}
      <div className="admin-list-table-frame">
        <AdminListTable
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
      </div>

      <InventoryAdjustmentModal
        open={adjustmentOpen}
        warehouses={warehouses}
        onCancel={closeAdjustment}
        onCompleted={handleAdjustmentCompleted}
      />

      <Modal
        open={exportModalOpen}
        title="确认导出"
        okText="确认导出"
        cancelText="取消"
        onOk={confirmExport}
        onCancel={() => setExportModalOpen(false)}
      >
        <p>
          将导出 <Text strong>{exportDateRangeLabel}</Text> 的库存流水记录，是否继续？
        </p>
      </Modal>
    </div>
  )
}
