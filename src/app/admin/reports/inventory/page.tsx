'use client'

import { useState, useEffect } from 'react'
import { Card, Table, Statistic, Row, Col, message, Button, Space } from 'antd'
import { Package, AlertTriangle, DollarSign } from 'lucide-react'
import { ReportChart } from '@/components/admin/reports/ReportChart'
import type { InventoryReportData } from '@/services/report.service'

export default function InventoryReportPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<InventoryReportData | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/reports/inventory')
      const result = await response.json()
      if (result.success) {
        setData(result.data)
      } else {
        message.error(result.error || '加载失败')
      }
    } catch (error) {
      console.error('加载库存报表失败:', error)
      message.error('加载库存报表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!data) return
    try {
      const response = await fetch('/api/reports/inventory/export')

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `库存报表_${new Date().toISOString().slice(0, 10)}.xlsx`
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
  }, [])

  const columns = [
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
      title: '分类',
      dataIndex: 'categoryName',
      key: 'categoryName',
    },
    {
      title: '仓库',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
    },
    {
      title: '库存数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: '可用库存',
      dataIndex: 'availableQuantity',
      key: 'availableQuantity',
      render: (value: number, record: any) => {
        const minStock = record.quantity - record.availableQuantity
        return (
          <span className={value < minStock ? 'font-semibold text-red-600' : ''}>
            {value.toLocaleString()}
          </span>
        )
      },
    },
    {
      title: '平均成本',
      dataIndex: 'avgCost',
      key: 'avgCost',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '库存金额',
      dataIndex: 'totalCost',
      key: 'totalCost',
      render: (value: number) => `¥${value.toLocaleString()}`,
    },
  ]

  const categoryData =
    data?.inventory.reduce(
      (acc, item) => {
        const existing = acc.find((a) => a.name === item.categoryName)
        if (existing) {
          existing.value += item.totalCost
        } else {
          acc.push({ name: item.categoryName, value: item.totalCost })
        }
        return acc
      },
      [] as Array<{ name: string; value: number }>
    ) || []

  return (
    <div className="p-6">
      <Card className="mb-6">
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="总库存量"
              value={data?.summary.totalQty || 0}
              prefix={<Package className="h-4 w-4" />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="库存总金额"
              value={data?.summary.totalAmount || 0}
              valueStyle={{ color: '#3f8600' }}
              prefix={<DollarSign className="h-4 w-4" />}
              suffix="¥"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="库存预警"
              value={data?.summary.lowStockCount || 0}
              valueStyle={{ color: '#cf1322' }}
              prefix={<AlertTriangle className="h-4 w-4" />}
            />
          </Col>
          <Col span={6}>
            <Statistic title="商品种类" value={data?.inventory.length || 0} />
          </Col>
        </Row>
      </Card>

      <Card className="mb-6">
        <Space>
          <Button onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button onClick={handleExport}>导出Excel</Button>
        </Space>
      </Card>

      <Card className="mb-6">
        <ReportChart
          type="pie"
          data={categoryData}
          dataKey="value"
          nameKey="name"
          title="库存分布（按分类）"
          height={300}
        />
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={data?.inventory || []}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  )
}
