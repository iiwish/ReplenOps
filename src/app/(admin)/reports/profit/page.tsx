'use client'

import { useState, useEffect } from 'react'
import { Card, DatePicker, Button, Table, Statistic, Row, Col, message, Space } from 'antd'
import { Download, Calendar, DollarSign, TrendingUp } from 'lucide-react'
import dayjs, { Dayjs } from 'dayjs'
import { ReportChart } from '@/components/admin/reports/ReportChart'
import type { ProfitReportData } from '@/services/report.service'

const { RangePicker } = DatePicker

export default function ProfitReportPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ProfitReportData | null>(null)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day'), dayjs()])

  const loadData = async () => {
    setLoading(true)
    try {
      const [startDate, endDate] = dateRange
      const response = await fetch('/api/reports/profit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: startDate.toDate(), endDate: endDate.toDate() }),
      })

      const result = await response.json()
      if (result.success) {
        setData(result.data)
      } else {
        message.error(result.error || '加载失败')
      }
    } catch (error) {
      console.error('加载利润报表失败:', error)
      message.error('加载利润报表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!data) return
    try {
      const response = await fetch('/api/reports/profit/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: dateRange[0].toDate(), endDate: dateRange[1].toDate() }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `利润报表_${dayjs().format('YYYY-MM-DD')}.xlsx`
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
  }, [dateRange])

  const columns = [
    {
      title: '订单号',
      dataIndex: 'orderCode',
      key: 'orderCode',
    },
    {
      title: '门店',
      dataIndex: 'storeName',
      key: 'storeName',
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (value: Date) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '销售收入',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (value: number) => `¥${value.toLocaleString()}`,
    },
    {
      title: '销售成本',
      dataIndex: 'cost',
      key: 'cost',
      render: (value: number) => `¥${value.toLocaleString()}`,
    },
    {
      title: '毛利润',
      dataIndex: 'profit',
      key: 'profit',
      render: (value: number) => (
        <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
          ¥{value.toLocaleString()}
        </span>
      ),
    },
    {
      title: '毛利率',
      dataIndex: 'profitRate',
      key: 'profitRate',
      render: (value: number) => (
        <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>{value.toFixed(2)}%</span>
      ),
    },
  ]

  const profitChartData =
    data?.stockOuts.slice(0, 30).map((s) => ({
      name: dayjs(s.completedAt).format('MM-DD'),
      value: s.profit,
    })) || []

  return (
    <div className="p-6">
      <Card className="mb-6">
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="销售收入"
              value={data?.summary.totalRevenue || 0}
              valueStyle={{ color: '#3f8600' }}
              prefix={<DollarSign className="h-4 w-4" />}
              suffix="¥"
            />
          </Col>
          <Col span={6}>
            <Statistic title="销售成本" value={data?.summary.totalCost || 0} suffix="¥" />
          </Col>
          <Col span={6}>
            <Statistic
              title="毛利润"
              value={data?.summary.totalProfit ?? 0}
              valueStyle={{ color: (data?.summary.totalProfit ?? 0) >= 0 ? '#3f8600' : '#cf1322' }}
              prefix={<TrendingUp className="h-4 w-4" />}
              suffix="¥"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="平均毛利率"
              value={data?.summary.avgProfitRate || 0}
              suffix="%"
              precision={2}
            />
          </Col>
        </Row>
      </Card>

      <Card className="mb-6">
        <Space className="w-full" size="large">
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as any)}
            placeholder={['开始日期', '结束日期']}
          />
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

      <Card className="mb-6">
        <ReportChart
          type="line"
          data={profitChartData}
          dataKey="value"
          nameKey="name"
          title="利润趋势"
          height={300}
        />
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={data?.stockOuts || []}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  )
}
