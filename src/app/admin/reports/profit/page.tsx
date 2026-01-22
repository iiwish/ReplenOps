'use client'

import { useState, useEffect } from 'react'
import { Card, Table, Select, DatePicker, Button, Tabs, message, Spin } from 'antd'
import {
  DollarOutlined,
  ShoppingCartOutlined,
  RiseOutlined,
  PercentageOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import {
  getProfitOverview,
  getProfitByStore,
  getProfitByGoods,
  getProfitByCategory,
  getProfitTrend,
} from '@/actions/profit-report-actions'

interface ProfitOverviewData {
  totalSales: number
  totalCost: number
  totalProfit: number
  profitRate: number
  orderCount: number
  averageProfitPerOrder: number
}

interface ProfitByStoreData {
  warehouseId: string
  warehouseName: string
  totalSales: number
  totalCost: number
  totalProfit: number
  profitRate: number
  orderCount: number
}

interface ProfitByGoodsData {
  goodsId: string
  goodsCode: string
  goodsName: string
  goodsSpec: string | null
  categoryName: string
  totalQuantity: number
  totalSales: number
  totalCost: number
  totalProfit: number
  profitRate: number
}

interface ProfitByCategoryData {
  categoryId: string
  categoryName: string
  totalSales: number
  totalCost: number
  totalProfit: number
  profitRate: number
  orderCount: number
  salesPercentage: number
}

interface TrendData {
  date: string
  totalSales: number
  totalCost: number
  totalProfit: number
  profitRate: number
  orderCount: number
}

export default function ProfitReportPage() {
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState<Dayjs>(dayjs().startOf('month'))
  const [endDate, setEndDate] = useState<Dayjs>(dayjs())
  const [storeId, setStoreId] = useState<string | undefined>()
  const [overview, setOverview] = useState<ProfitOverviewData | null>(null)
  const [byStoreData, setByStoreData] = useState<ProfitByStoreData[]>([])
  const [byGoodsData, setByGoodsData] = useState<ProfitByGoodsData[]>([])
  const [byCategoryData, setByCategoryData] = useState<ProfitByCategoryData[]>([])
  const [trendData, setTrendData] = useState<TrendData[]>([])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = {
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
        storeId,
      }

      const [overviewRes, storeRes, goodsRes, categoryRes, trendRes] = await Promise.all([
        getProfitOverview(params),
        getProfitByStore(params),
        getProfitByGoods(params, { page: 1, pageSize: 100 }),
        getProfitByCategory(params),
        getProfitTrend(params, { groupBy: 'day' }),
      ])

      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data as ProfitOverviewData)
      }
      if (storeRes.success && storeRes.data) {
        setByStoreData(storeRes.data as ProfitByStoreData[])
      }
      if (goodsRes.success && goodsRes.data) {
        setByGoodsData((goodsRes.data as { data: ProfitByGoodsData[] }).data)
      }
      if (categoryRes.success && categoryRes.data) {
        setByCategoryData(categoryRes.data as ProfitByCategoryData[])
      }
      if (trendRes.success && trendRes.data) {
        setTrendData(trendRes.data as TrendData[])
      }
    } catch (error) {
      message.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [startDate, endDate, storeId])

  const storeColumns: ColumnsType<ProfitByStoreData> = [
    {
      title: '仓库名称',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
    },
    {
      title: '销售总额',
      dataIndex: 'totalSales',
      key: 'totalSales',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '成本总额',
      dataIndex: 'totalCost',
      key: 'totalCost',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '利润总额',
      dataIndex: 'totalProfit',
      key: 'totalProfit',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '利润率',
      dataIndex: 'profitRate',
      key: 'profitRate',
      render: (value: number) => `${value.toFixed(2)}%`,
    },
    {
      title: '订单数',
      dataIndex: 'orderCount',
      key: 'orderCount',
    },
  ]

  const goodsColumns: ColumnsType<ProfitByGoodsData> = [
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
      title: '规格',
      dataIndex: 'goodsSpec',
      key: 'goodsSpec',
    },
    {
      title: '分类',
      dataIndex: 'categoryName',
      key: 'categoryName',
    },
    {
      title: '销售数量',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
    },
    {
      title: '销售总额',
      dataIndex: 'totalSales',
      key: 'totalSales',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '成本总额',
      dataIndex: 'totalCost',
      key: 'totalCost',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '利润总额',
      dataIndex: 'totalProfit',
      key: 'totalProfit',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '利润率',
      dataIndex: 'profitRate',
      key: 'profitRate',
      render: (value: number) => `${value.toFixed(2)}%`,
    },
  ]

  const categoryColumns: ColumnsType<ProfitByCategoryData> = [
    {
      title: '分类名称',
      dataIndex: 'categoryName',
      key: 'categoryName',
    },
    {
      title: '销售总额',
      dataIndex: 'totalSales',
      key: 'totalSales',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '成本总额',
      dataIndex: 'totalCost',
      key: 'totalCost',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '利润总额',
      dataIndex: 'totalProfit',
      key: 'totalProfit',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '利润率',
      dataIndex: 'profitRate',
      key: 'profitRate',
      render: (value: number) => `${value.toFixed(2)}%`,
    },
    {
      title: '销售占比',
      dataIndex: 'salesPercentage',
      key: 'salesPercentage',
      render: (value: number) => `${value.toFixed(2)}%`,
    },
  ]

  const trendColumns: ColumnsType<TrendData> = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: '销售总额',
      dataIndex: 'totalSales',
      key: 'totalSales',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '成本总额',
      dataIndex: 'totalCost',
      key: 'totalCost',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '利润总额',
      dataIndex: 'totalProfit',
      key: 'totalProfit',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '利润率',
      dataIndex: 'profitRate',
      key: 'profitRate',
      render: (value: number) => `${value.toFixed(2)}%`,
    },
    {
      title: '订单数',
      dataIndex: 'orderCount',
      key: 'orderCount',
    },
  ]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="mb-4 text-2xl font-bold">利润分析</h1>
        <div className="flex flex-wrap gap-4">
          <div>
            <span className="mr-2">开始日期:</span>
            <DatePicker value={startDate} onChange={(date) => setStartDate(date!)} />
          </div>
          <div>
            <span className="mr-2">结束日期:</span>
            <DatePicker value={endDate} onChange={(date) => setEndDate(date!)} />
          </div>
          <div>
            <span className="mr-2">门店:</span>
            <Select
              style={{ width: 200 }}
              placeholder="全部门店"
              value={storeId}
              onChange={setStoreId}
              allowClear
            />
          </div>
          <Button type="primary" onClick={fetchData} loading={loading}>
            查询
          </Button>
        </div>
      </div>

      <Spin spinning={loading}>
        {overview && (
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card>
              <div className="mb-2 flex items-center gap-2">
                <DollarOutlined className="text-green-500" />
                <span className="text-gray-500">销售总额</span>
              </div>
              <div className="text-2xl font-bold">¥{overview.totalSales.toFixed(2)}</div>
            </Card>
            <Card>
              <div className="mb-2 flex items-center gap-2">
                <ShoppingCartOutlined className="text-orange-500" />
                <span className="text-gray-500">成本总额</span>
              </div>
              <div className="text-2xl font-bold">¥{overview.totalCost.toFixed(2)}</div>
            </Card>
            <Card>
              <div className="mb-2 flex items-center gap-2">
                <RiseOutlined className="text-blue-500" />
                <span className="text-gray-500">利润总额</span>
              </div>
              <div className="text-2xl font-bold">¥{overview.totalProfit.toFixed(2)}</div>
            </Card>
            <Card>
              <div className="mb-2 flex items-center gap-2">
                <PercentageOutlined className="text-purple-500" />
                <span className="text-gray-500">利润率</span>
              </div>
              <div className="text-2xl font-bold">{overview.profitRate}%</div>
            </Card>
          </div>
        )}

        <Card title="利润趋势">
          <Table
            columns={trendColumns}
            dataSource={trendData}
            rowKey="date"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1000 }}
          />
        </Card>

        <Tabs
          defaultActiveKey="store"
          className="mt-6"
          items={[
            {
              key: 'store',
              label: '按仓库统计',
              children: (
                <Table
                  columns={storeColumns}
                  dataSource={byStoreData}
                  rowKey="warehouseId"
                  pagination={false}
                  scroll={{ x: 1000 }}
                />
              ),
            },
            {
              key: 'goods',
              label: '按商品统计',
              children: (
                <Table
                  columns={goodsColumns}
                  dataSource={byGoodsData}
                  rowKey="goodsId"
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: 1200 }}
                />
              ),
            },
            {
              key: 'category',
              label: '按分类统计',
              children: (
                <Table
                  columns={categoryColumns}
                  dataSource={byCategoryData}
                  rowKey="categoryId"
                  pagination={false}
                  scroll={{ x: 1000 }}
                />
              ),
            },
          ]}
        />
      </Spin>
    </div>
  )
}
