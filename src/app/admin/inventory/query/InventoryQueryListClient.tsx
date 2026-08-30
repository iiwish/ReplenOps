'use client'

import type { Route } from 'next'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Select, Space, Card, Input, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { InventoryQueryResult } from '@/services/inventory-query.service'

interface InventoryQueryListClientProps {
  initialData: InventoryQueryResult
  initialFilters: {
    warehouseIds: string[]
    categoryId?: string
    stockStatus: string
    keyword?: string
  }
  warehouses: Array<{ id: number; code: string; name: string }>
  categories: Array<{ id: string; name: string }>
}

type InventoryRecord = InventoryQueryResult['data'][number]

export default function InventoryQueryListClient({
  initialData,
  initialFilters,
  warehouses,
  categories,
}: InventoryQueryListClientProps) {
  const router = useRouter()
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>(
    initialFilters.warehouseIds
  )
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(
    initialFilters.categoryId
  )
  const [stockStatus, setStockStatus] = useState(initialFilters.stockStatus)
  const [searchKeyword, setSearchKeyword] = useState(initialFilters.keyword ?? '')

  const buildUrl = (updates: Record<string, string | string[] | undefined>) => {
    const nextFilters: Record<string, string | string[] | undefined> = {
      page: '1',
      warehouseIds: selectedWarehouses,
      categoryId: selectedCategory,
      keyword: searchKeyword,
      stockStatus,
      ...updates,
    }
    const params = new URLSearchParams()
    const setParam = (name: string, value: string | string[] | undefined) => {
      const normalizedValue = Array.isArray(value) ? value[0] : value
      if (normalizedValue) params.set(name, normalizedValue)
    }

    setParam('page', nextFilters.page)
    if (nextFilters.warehouseIds) {
      if (Array.isArray(nextFilters.warehouseIds)) {
        nextFilters.warehouseIds.forEach((id) => params.append('warehouseIds', id))
      } else {
        params.set('warehouseIds', nextFilters.warehouseIds)
      }
    }
    setParam('categoryId', nextFilters.categoryId)
    setParam('goodsId', nextFilters.goodsId)
    setParam('keyword', nextFilters.keyword)
    setParam('stockStatus', nextFilters.stockStatus)

    const queryString = params.toString()
    router.push(`/admin/inventory/query${queryString ? `?${queryString}` : ''}` as Route)
  }

  const handleWarehouseChange = (values: string[]) => {
    setSelectedWarehouses(values)
    buildUrl({ warehouseIds: values, page: '1' })
  }

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value)
    buildUrl({ categoryId: value, page: '1' })
  }

  const handleStatusChange = (value: string) => {
    setStockStatus(value)
    buildUrl({ stockStatus: value, page: '1' })
  }

  const handleSearch = () => {
    buildUrl({ keyword: searchKeyword, page: '1' })
  }

  const columns: ColumnsType<InventoryRecord> = [
    {
      title: '仓库',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      width: 105,
      ellipsis: true,
    },
    {
      title: '商品编码',
      dataIndex: 'goodsCode',
      key: 'goodsCode',
      width: 100,
    },
    {
      title: '商品名称',
      dataIndex: 'goodsName',
      key: 'goodsName',
      width: 125,
      ellipsis: true,
    },
    {
      title: '规格',
      dataIndex: 'goodsSpec',
      key: 'goodsSpec',
      width: 75,
      ellipsis: true,
    },
    {
      title: '单位',
      dataIndex: 'goodsUnit',
      key: 'goodsUnit',
      width: 55,
    },
    {
      title: '总库存',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 75,
      align: 'right',
    },
    {
      title: '锁定',
      dataIndex: 'lockedQuantity',
      key: 'lockedQuantity',
      width: 65,
      align: 'right',
    },
    {
      title: '可用',
      dataIndex: 'availableQuantity',
      key: 'availableQuantity',
      width: 70,
      align: 'right',
      render: (qty: number, record) => {
        const color = qty === 0 ? 'red' : record.isLowStock ? 'orange' : 'green'
        return <span style={{ color, fontWeight: 'bold' }}>{qty}</span>
      },
    },
    {
      title: '平均成本',
      dataIndex: 'avgCost',
      key: 'avgCost',
      width: 85,
      align: 'right',
      render: (cost: number) => `¥${cost.toFixed(2)}`,
    },
    {
      title: '库存金额',
      dataIndex: 'stockAmount',
      key: 'stockAmount',
      width: 95,
      align: 'right',
      render: (amount: number) => `¥${amount.toFixed(2)}`,
    },
    {
      title: '最后更新',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 110,
      render: (date: Date) => {
        const value = new Date(date)
        return (
          <div className="whitespace-nowrap leading-5">
            <div>{value.toLocaleDateString('zh-CN')}</div>
            <div className="text-xs text-gray-500">{value.toLocaleTimeString('zh-CN')}</div>
          </div>
        )
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: (_, record) => {
        if (record.quantity === 0) {
          return <Tag color="default">零库存</Tag>
        }
        if (record.isLowStock) {
          return <Tag color="orange">低库存</Tag>
        }
        return <Tag color="green">正常</Tag>
      },
    },
  ]

  return (
    <div>
      <Card variant="borderless">
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space wrap>
              <Select
                mode="multiple"
                placeholder="选择仓库"
                style={{ width: 200 }}
                value={selectedWarehouses}
                onChange={handleWarehouseChange}
                options={warehouses.map((w) => ({ label: w.name, value: String(w.id) }))}
                allowClear
              />

              <Select
                placeholder="选择分类"
                style={{ width: 150 }}
                value={selectedCategory}
                onChange={handleCategoryChange}
                options={[
                  { label: '全部分类', value: '' },
                  ...categories.map((c) => ({ label: c.name, value: c.id })),
                ]}
              />

              <Select
                placeholder="库存状态"
                style={{ width: 150 }}
                value={stockStatus}
                onChange={handleStatusChange}
                options={[
                  { label: '全部状态', value: 'all' },
                  { label: '有库存', value: 'has_stock' },
                  { label: '零库存', value: 'zero_stock' },
                  { label: '低库存', value: 'low_stock' },
                ]}
              />

              <Input.Search
                placeholder="搜索商品编码或名称"
                style={{ width: 250 }}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onSearch={handleSearch}
                allowClear
              />
            </Space>
          </div>

          <div style={{ fontSize: '14px', color: '#666' }}>
            合计库存数量：<strong>{initialData.summary.totalQuantity}</strong> 件， 合计库存金额：
            <strong>¥{initialData.summary.totalStockAmount.toFixed(2)}</strong>
          </div>

          <Table
            columns={columns}
            dataSource={initialData.data}
            rowKey="id"
            pagination={{
              current: initialData.page,
              pageSize: initialData.pageSize,
              total: initialData.total,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page) => buildUrl({ page: page.toString() }),
            }}
            tableLayout="fixed"
            scroll={{ x: 1040 }}
          />
        </Space>
      </Card>
    </div>
  )
}
