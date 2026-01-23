'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  DatePicker,
  Button,
  Select,
  Table,
  Tabs,
  TabsProps,
  message,
  Space,
  Row,
  Col,
  Statistic,
} from 'antd'
import { Download, Calendar } from 'lucide-react'
import dayjs, { Dayjs } from 'dayjs'
import { ReportChart } from '@/components/admin/reports/ReportChart'
import type { SalesReportData } from '@/services/report.service'

const { RangePicker } = DatePicker

interface FilterState {
  dateRange: [Dayjs, Dayjs] | null
  storeIds: string[]
  categoryId?: string
}

export default function SalesReportPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SalesReportData | null>(null)
  const [filters, setFilters] = useState<FilterState>({
    dateRange: [dayjs().subtract(30, 'day'), dayjs()],
    storeIds: [],
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const [startDate, endDate] = filters.dateRange || [dayjs(), dayjs()]
      const response = await fetch('/api/reports/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: startDate.toDate(),
          endDate: endDate.toDate(),
          storeIds: filters.storeIds.length > 0 ? filters.storeIds : undefined,
          categoryId: filters.categoryId,
        }),
      })

      const result = await response.json()
      if (result.success) {
        setData(result.data)
      } else {
        message.error(result.error || '加载失败')
      }
    } catch (error) {
      console.error('加载销售报表失败:', error)
      message.error('加载销售报表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!data) return
    try {
      const response = await fetch('/api/reports/sales/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `销售报表_${dayjs().format('YYYY-MM-DD')}.xlsx`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        message.success('导出成功')
      }
    } catch (error) {
      console.error('导出失败:', error)
      message.error('导出失败')
    }
  }

  useEffect(() => {
    loadData()
  }, [filters])

  const dailyColumns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: '订单数',
      dataIndex: 'orderCount',
      key: 'orderCount',
    },
    {
      title: '销售金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (value: number) => `¥${value.toLocaleString()}`,
    },
  ]

  const storeColumns = [
    {
      title: '门店',
      dataIndex: 'storeName',
      key: 'storeName',
    },
    {
      title: '订单数',
      dataIndex: 'orderCount',
      key: 'orderCount',
    },
    {
      title: '销售金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (value: number) => `¥${value.toLocaleString()}`,
    },
  ]

  const goodsColumns = [
    {
      title: '商品编码',
      dataIndex: 'goodsCode',
      key: 'goodsCode',
    },
    {
      title: '商品名称',
      dataIndex: 'goodsName',
      key: 'goodsName',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: '销售金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (value: number) => `¥${value.toLocaleString()}`,
    },
  ]

  const tabItems: TabsProps['items'] = [
    {
      key: 'daily',
      label: '每日趋势',
      children: (
        <div>
          <ReportChart
            type="line"
            data={
              data?.dailySales.map((d) => ({
                name: d.date,
                value: d.totalAmount,
              })) || []
            }
            dataKey="value"
            nameKey="name"
            title="每日销售趋势"
            height={300}
          />
          <Table
            columns={dailyColumns}
            dataSource={data?.dailySales || []}
            rowKey="date"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </div>
      ),
    },
    {
      key: 'store',
      label: '门店排行',
      children: (
        <div>
          <ReportChart
            type="bar"
            data={
              data?.storeSales.slice(0, 10).map((s) => ({
                name: s.storeName,
                value: s.totalAmount,
              })) || []
            }
            dataKey="value"
            nameKey="name"
            title="门店销售排行"
            height={300}
          />
          <Table
            columns={storeColumns}
            dataSource={data?.storeSales || []}
            rowKey="storeId"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </div>
      ),
    },
    {
      key: 'goods',
      label: '商品排行',
      children: (
        <div>
          <ReportChart
            type="pie"
            data={
              data?.goodsSales.slice(0, 5).map((g) => ({
                name: g.goodsName,
                value: g.totalAmount,
              })) || []
            }
            dataKey="value"
            nameKey="name"
            title="Top 5 商品"
            height={300}
          />
          <Table
            columns={goodsColumns}
            dataSource={data?.goodsSales || []}
            rowKey="goodsId"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="p-6">
      <Card className="mb-6">
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="总订单数"
              value={data?.dailySales.reduce((sum, d) => sum + d.orderCount, 0) || 0}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="总销售金额"
              value={data?.dailySales.reduce((sum, d) => sum + d.totalAmount, 0) || 0}
              prefix="¥"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="日均订单"
              value={
                data
                  ? Math.round(
                      data.dailySales.reduce((sum, d) => sum + d.orderCount, 0) /
                        data.dailySales.length
                    )
                  : 0
              }
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="日均销售"
              value={
                data
                  ? Math.round(
                      data.dailySales.reduce((sum, d) => sum + d.totalAmount, 0) /
                        data.dailySales.length
                    )
                  : 0
              }
              prefix="¥"
            />
          </Col>
        </Row>
      </Card>

      <Card className="mb-6">
        <Space className="w-full" size="large">
          <RangePicker
            value={filters.dateRange}
            onChange={(dates) => setFilters((prev) => ({ ...prev, dateRange: dates as any }))}
            placeholder={['开始日期', '结束日期']}
          />
          <Select
            mode="multiple"
            placeholder="选择门店"
            style={{ width: 200 }}
            value={filters.storeIds}
            onChange={(values) => setFilters((prev) => ({ ...prev, storeIds: values as any }))}
          >
            <Select.Option value="store1">门店1</Select.Option>
            <Select.Option value="store2">门店2</Select.Option>
          </Select>
          <Button
            type="primary"
            icon={<Calendar className="h-4 w-4" />}
            onClick={loadData}
            loading={loading}
          >
            查询
          </Button>
          <Button icon={<Download className="h-4 w-4" />} onClick={handleExport}>
            导出Excel
          </Button>
        </Space>
      </Card>

      <Card>
        <Tabs items={tabItems} />
      </Card>
    </div>
  )
}
