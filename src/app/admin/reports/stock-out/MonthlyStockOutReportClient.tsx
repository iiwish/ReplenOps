'use client'

import { useEffect, useRef, useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  App,
  Button,
  Col,
  DatePicker,
  Input,
  Modal,
  Row,
  Segmented,
  Select,
  Statistic,
  Tag,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { formatShanghaiDateTime, getShanghaiMonth } from '@/lib/shanghai-time'
import type {
  MonthlyStockOutReportData,
  MonthlyStockOutReportFilters,
  MonthlyStockOutReportOptions,
  MonthlyStockOutReportRow,
} from '@/services/monthly-stock-out-report.service'
import AdminListTable from '@/components/admin/AdminListTable'

interface MonthlyStockOutReportClientProps {
  initialData: MonthlyStockOutReportData
  options: MonthlyStockOutReportOptions
  filters: MonthlyStockOutReportFilters
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: '已出库', color: 'green' },
  CANCELLED: { label: '已撤销', color: 'default' },
}

export default function MonthlyStockOutReportClient({
  initialData,
  options,
  filters,
}: MonthlyStockOutReportClientProps) {
  const router = useRouter()
  const { message } = App.useApp()
  const [month, setMonth] = useState(filters.month)
  const [keyword, setKeyword] = useState(filters.keyword ?? '')
  const [status, setStatus] = useState(filters.status)
  const [warehouseId, setWarehouseId] = useState(filters.warehouseId)
  const [storeId, setStoreId] = useState(filters.storeId)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const filterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buildParams = (overrides: Partial<MonthlyStockOutReportFilters> = {}) => {
    const next = { month, keyword, status, warehouseId, storeId, ...overrides }
    const params = new URLSearchParams({ month: next.month })
    if (next.keyword?.trim()) params.set('keyword', next.keyword.trim())
    if (next.status) params.set('status', next.status)
    if (next.warehouseId) params.set('warehouseId', next.warehouseId)
    if (next.storeId) params.set('storeId', next.storeId)
    return params
  }

  const scheduleFilterApply = (overrides: Partial<MonthlyStockOutReportFilters> = {}) => {
    if (filterTimer.current) clearTimeout(filterTimer.current)
    filterTimer.current = setTimeout(() => {
      router.push(`/admin/reports/stock-out?${buildParams(overrides).toString()}` as Route)
      filterTimer.current = null
    }, 350)
  }

  const applyMonth = (value: string) => {
    setMonth(value)
    scheduleFilterApply({ month: value })
  }

  useEffect(() => {
    return () => {
      if (filterTimer.current) clearTimeout(filterTimer.current)
    }
  }, [])

  const confirmExport = async () => {
    setExporting(true)
    try {
      const response = await fetch(`/api/reports/stock-out/export?${buildParams().toString()}`)
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        message.error(result?.error || '导出失败')
        return
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `月度出库报表_${month}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      message.success('导出成功')
      setExportModalOpen(false)
    } catch (error) {
      console.error('导出月度出库报表失败:', error)
      message.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  const columns: ColumnsType<MonthlyStockOutReportRow> = [
    {
      title: '出库单号',
      dataIndex: 'stockOutCode',
      key: 'stockOutCode',
      width: 170,
      render: (value: string, record) => (
        <Link className="text-blue-600 hover:underline" href={`/admin/stock-out/${record.id}`}>
          {value}
        </Link>
      ),
    },
    {
      title: '订单号',
      dataIndex: 'orderCode',
      key: 'orderCode',
      width: 170,
      render: (value: string, record) => (
        <Link className="text-blue-600 hover:underline" href={`/admin/orders/${record.orderId}`}>
          {value}
        </Link>
      ),
    },
    {
      title: '实际出库时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 170,
      render: (value: Date) => formatShanghaiDateTime(new Date(value)),
    },
    { title: '门店', dataIndex: 'storeName', key: 'storeName', width: 160 },
    { title: '仓库', dataIndex: 'warehouseName', key: 'warehouseName', width: 130 },
    {
      title: '出库状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: string) => {
        const config = STATUS_CONFIG[value] ?? { label: value, color: 'default' }
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    {
      title: '出库金额',
      dataIndex: 'issueAmount',
      key: 'issueAmount',
      width: 120,
      align: 'right',
      render: (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
    },
    {
      title: '订单金额',
      dataIndex: 'orderAmount',
      key: 'orderAmount',
      width: 120,
      align: 'right',
      render: (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
    },
    { title: '创建人', dataIndex: 'creatorName', key: 'creatorName', width: 130 },
    {
      title: '异常',
      dataIndex: 'warnings',
      key: 'warnings',
      width: 180,
      render: (warnings: string[]) =>
        warnings.length > 0 ? <Tag color="warning">{warnings.join('；')}</Tag> : '-',
    },
  ]

  const { summary } = initialData
  const previousMonth = getShanghaiMonth(-1)
  const currentMonth = getShanghaiMonth(0)
  const quickMonth =
    month === previousMonth ? 'previous' : month === currentMonth ? 'current' : undefined

  return (
    <div className="admin-list-page space-y-5 p-6">
      <div className="shrink-0 border-b border-gray-200 pb-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 text-sm font-medium text-gray-700">统计月份</span>
            <Segmented
              value={quickMonth}
              options={[
                { label: '上月', value: 'previous' },
                { label: '本月', value: 'current' },
              ]}
              onChange={(value) => applyMonth(value === 'previous' ? previousMonth : currentMonth)}
            />
            <DatePicker
              className="w-[132px]"
              picker="month"
              allowClear={false}
              value={dayjs(`${month}-01`)}
              onChange={(value) => value && applyMonth(value.format('YYYY-MM'))}
            />
          </div>
          <Button
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={() => setExportModalOpen(true)}
          >
            导出 Excel
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-[minmax(120px,0.8fr)_minmax(130px,1fr)_minmax(150px,1.1fr)_minmax(180px,1.5fr)_auto] gap-2">
          <Select
            className="w-full"
            allowClear
            placeholder="全部状态"
            value={status}
            onChange={(value) => {
              setStatus(value)
              scheduleFilterApply({ status: value })
            }}
            options={[
              { value: 'COMPLETED', label: '已出库' },
              { value: 'CANCELLED', label: '已撤销' },
            ]}
          />
          <Select
            className="w-full"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="全部仓库"
            value={warehouseId}
            onChange={(value) => {
              setWarehouseId(value)
              scheduleFilterApply({ warehouseId: value })
            }}
            options={options.warehouses.map((item) => ({
              value: item.id,
              label: `${item.name}${item.isDeleted ? '（已删除）' : ''}`,
            }))}
          />
          <Select
            className="w-full"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="全部门店"
            value={storeId}
            onChange={(value) => {
              setStoreId(value)
              scheduleFilterApply({ storeId: value })
            }}
            options={options.stores.map((item) => ({
              value: item.id,
              label: `${item.name}${item.isDeleted ? '（已删除）' : ''}`,
            }))}
          />
          <Input
            className="w-full"
            allowClear
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder="出库单号或订单号"
            value={keyword}
            onChange={(event) => {
              const value = event.target.value
              setKeyword(value)
              scheduleFilterApply({ keyword: value })
            }}
          />
        </div>
      </div>

      <div className="shrink-0 border-y border-gray-200 bg-white px-4 py-5">
        <Row gutter={[24, 20]}>
          <Col xs={12} md={6}>
            <Statistic title="实际出库单" value={summary.stockOutCount} suffix="张" />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="涉及门店" value={summary.storeCount} suffix="家" />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="出库数量" value={summary.totalQuantity} precision={3} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="出库金额" value={summary.issueAmount} precision={2} prefix="¥" />
          </Col>
        </Row>
      </div>

      {(summary.revokedCount > 0 || summary.warningCount > 0) && (
        <Alert
          showIcon
          type="warning"
          title={`已撤销 ${summary.revokedCount} 张，撤销金额 ¥${summary.revokedAmount.toFixed(2)}；异常单据 ${summary.warningCount} 张；净出库金额 ¥${summary.netIssueAmount.toFixed(2)}`}
        />
      )}

      <div className="admin-list-table-frame">
        <AdminListTable
          columns={columns}
          dataSource={initialData.rows}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 张出库单`,
          }}
          scroll={{ x: 1450 }}
        />
      </div>

      <Modal
        open={exportModalOpen}
        title="确认导出"
        okText="确认导出"
        cancelText="取消"
        confirmLoading={exporting}
        onOk={() => void confirmExport()}
        onCancel={() => setExportModalOpen(false)}
      >
        <p>
          将导出 <strong>{month}</strong> 月的出库报表，包含当前筛选条件下的数据，是否继续？
        </p>
      </Modal>
    </div>
  )
}
