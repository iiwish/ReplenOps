'use client'

import { useState } from 'react'
import type { Route } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Button,
  Col,
  DatePicker,
  Input,
  message,
  Row,
  Segmented,
  Select,
  Statistic,
  Table,
  Tag,
  Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { formatShanghaiDateTime, getShanghaiMonth } from '@/lib/shanghai-time'
import type {
  MonthlyStockOutReportData,
  MonthlyStockOutReportFilters,
  MonthlyStockOutReportOptions,
  MonthlyStockOutReportRow,
} from '@/services/monthly-stock-out-report.service'

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
  const [month, setMonth] = useState(filters.month)
  const [keyword, setKeyword] = useState(filters.keyword ?? '')
  const [status, setStatus] = useState(filters.status)
  const [warehouseId, setWarehouseId] = useState(filters.warehouseId)
  const [storeId, setStoreId] = useState(filters.storeId)
  const [exporting, setExporting] = useState(false)

  const buildParams = () => {
    const params = new URLSearchParams({ month })
    if (keyword.trim()) params.set('keyword', keyword.trim())
    if (status) params.set('status', status)
    if (warehouseId) params.set('warehouseId', warehouseId)
    if (storeId) params.set('storeId', storeId)
    return params
  }

  const applyFilters = () => {
    router.push(`/admin/reports/stock-out?${buildParams().toString()}` as Route)
  }

  const applyMonth = (value: string) => {
    setMonth(value)
    const params = buildParams()
    params.set('month', value)
    router.push(`/admin/reports/stock-out?${params.toString()}` as Route)
  }

  const resetFilters = () => {
    const previousMonth = getShanghaiMonth(-1)
    setMonth(previousMonth)
    setKeyword('')
    setStatus(undefined)
    setWarehouseId(undefined)
    setStoreId(undefined)
    router.push(`/admin/reports/stock-out?month=${previousMonth}` as Route)
  }

  const handleExport = async () => {
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
    <div className="space-y-5 p-6">
      <div className="border-b border-gray-200 pb-5">
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
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
            导出 Excel
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-[minmax(120px,0.8fr)_minmax(130px,1fr)_minmax(150px,1.1fr)_minmax(180px,1.5fr)_auto] gap-2">
          <Select
            className="w-full"
            allowClear
            placeholder="全部状态"
            value={status}
            onChange={setStatus}
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
            onChange={setWarehouseId}
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
            onChange={setStoreId}
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
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={applyFilters}
          />
          <div className="flex items-center gap-2">
            <Button type="primary" icon={<SearchOutlined />} onClick={applyFilters}>
              查询
            </Button>
            <Tooltip title="重置筛选">
              <Button aria-label="重置筛选" icon={<ReloadOutlined />} onClick={resetFilters} />
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="border-y border-gray-200 bg-white px-4 py-5">
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

      <Table
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
  )
}
