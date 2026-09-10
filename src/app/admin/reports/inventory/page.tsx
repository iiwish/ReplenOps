'use client'

import { useState, useEffect } from 'react'
import { Card, Table, Statistic, Row, Col, message, Space } from 'antd'
import { Package, AlertTriangle } from 'lucide-react'
import { ReportChart } from '@/components/admin/reports/ReportChart'
import type { InventoryReportData } from '@/services/report.service'

const formatAmount = (value: number) =>
  `¥${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

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

  useEffect(() => {
    loadData()
  }, [])

  const lowStockColumns = [
    { title: '商品编码', dataIndex: 'goodsCode', key: 'goodsCode' },
    { title: '商品名称', dataIndex: 'goodsName', key: 'goodsName' },
    {
      title: '规格',
      dataIndex: 'goodsSpec',
      key: 'goodsSpec',
      render: (value: string | null) => value || '-',
    },
    { title: '单位', dataIndex: 'goodsUnit', key: 'goodsUnit' },
    { title: '分类', dataIndex: 'categoryName', key: 'categoryName' },
    { title: '仓库', dataIndex: 'warehouseName', key: 'warehouseName' },
    {
      title: '可用库存',
      dataIndex: 'availableQuantity',
      key: 'availableQuantity',
      render: (value: number) => <span className="font-semibold text-red-600">{value}</span>,
    },
    { title: '预警值', dataIndex: 'minStock', key: 'minStock' },
    {
      title: '缺口',
      dataIndex: 'shortageQuantity',
      key: 'shortageQuantity',
      render: (value: number) => <span className="font-semibold text-red-600">{value}</span>,
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
              precision={2}
              prefix="¥"
              styles={{ content: { color: '#3f8600' } }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="库存预警"
              value={data?.summary.lowStockCount || 0}
              styles={{ content: { color: '#cf1322' } }}
              prefix={<AlertTriangle className="h-4 w-4" />}
            />
          </Col>
          <Col span={6}>
            <Statistic title="商品种类" value={data?.inventory.length || 0} />
          </Col>
        </Row>
      </Card>

      <Card className="mb-6">
        <ReportChart
          type="pie"
          data={categoryData}
          dataKey="value"
          nameKey="name"
          title="库存分布（按分类）"
          height={300}
          valueFormatter={formatAmount}
        />
      </Card>

      <Card className="mb-6">
        <Table
          title={() => (
            <Space>
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <strong>预警商品明细</strong>
            </Space>
          )}
          columns={lowStockColumns}
          dataSource={data?.lowStockItems || []}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '当前没有库存预警商品' }}
          scroll={{ x: 900 }}
        />
      </Card>
    </div>
  )
}
