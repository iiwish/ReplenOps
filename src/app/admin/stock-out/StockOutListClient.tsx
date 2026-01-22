'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Modal,
  message,
  Card,
  Select,
  DatePicker,
  Statistic,
  Row,
  Col,
} from 'antd'
import {
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
  DollarOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { completeStockOut, cancelStockOut } from '@/actions/stock-out-actions'
import type { PaginatedStockOutResult } from '@/services/stock-out.service'
import dayjs from 'dayjs'

const { Search } = Input
const { RangePicker } = DatePicker

interface StockOutListClientProps {
  initialData: PaginatedStockOutResult
  warehouses: Array<{ id: string; code: string; name: string }>
}

type StockOutRecord = PaginatedStockOutResult['data'][number]

const statusMap = {
  PENDING: { text: '待出库', color: 'warning', icon: <ExclamationCircleOutlined /> },
  COMPLETED: { text: '已出库', color: 'success', icon: <CheckCircleOutlined /> },
  CANCELLED: { text: '已取消', color: 'default', icon: <CloseCircleOutlined /> },
}

export default function StockOutListClient({ initialData, warehouses }: StockOutListClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>()
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>()
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)

  const handleSearch = (value: string) => {
    setSearchKeyword(value)
    buildUrl({ keyword: value })
  }

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value)
    buildUrl({ status: value })
  }

  const handleWarehouseChange = (value: string) => {
    setSelectedWarehouse(value)
    buildUrl({ warehouseId: value })
  }

  const handleDateRangeChange = (dates: any) => {
    if (dates && dates[0] && dates[1]) {
      const range: [string, string] = [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]
      setDateRange(range)
      buildUrl({ startDate: range[0], endDate: range[1] })
    } else {
      setDateRange(null)
      buildUrl({ startDate: undefined, endDate: undefined })
    }
  }

  const buildUrl = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams()

    const currentKeyword = updates.keyword !== undefined ? updates.keyword : searchKeyword
    const currentStatus = updates.status !== undefined ? updates.status : selectedStatus
    const currentWarehouse =
      updates.warehouseId !== undefined ? updates.warehouseId : selectedWarehouse
    const currentStartDate = updates.startDate !== undefined ? updates.startDate : dateRange?.[0]
    const currentEndDate = updates.endDate !== undefined ? updates.endDate : dateRange?.[1]

    if (currentKeyword) params.set('keyword', currentKeyword)
    if (currentStatus) params.set('status', currentStatus)
    if (currentWarehouse) params.set('warehouseId', currentWarehouse)
    if (currentStartDate) params.set('startDate', currentStartDate)
    if (currentEndDate) params.set('endDate', currentEndDate)

    router.push(`/admin/stock-out?${params.toString()}`)
  }

  const handleComplete = (record: StockOutRecord) => {
    Modal.confirm({
      title: '确认出库',
      content: `确定要确认出库单"${record.code}"吗？此操作将扣减库存并计算利润。`,
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setLoading(true)
        try {
          const result = await completeStockOut(record.id)
          if (result.success) {
            message.success(result.message)
            router.refresh()
          } else {
            message.error(result.message || '出库失败')
          }
        } catch (error) {
          message.error('出库失败，请重试')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  const handleCancel = (record: StockOutRecord) => {
    let cancelReason = ''
    Modal.confirm({
      title: '取消出库单',
      content: (
        <div>
          <p>确定要取消出库单"{record.code}"吗？</p>
          <Input.TextArea
            placeholder="请填写取消原因"
            rows={4}
            onChange={(e) => {
              cancelReason = e.target.value
            }}
          />
        </div>
      ),
      okText: '确认取消',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!cancelReason || cancelReason.trim() === '') {
          message.error('请填写取消原因')
        }

        setLoading(true)
        try {
          const result = await cancelStockOut(record.id, { reason: cancelReason })
          if (result.success) {
            message.success(result.message)
            router.refresh()
          } else {
            message.error(result.message || '取消失败')
          }
        } catch (error) {
          message.error('取消失败，请重试')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  const columns: ColumnsType<StockOutRecord> = [
    {
      title: '出库单号',
      dataIndex: 'code',
      key: 'code',
      width: 150,
      render: (text, record) => (
        <a onClick={() => router.push(`/admin/stock-out/${record.id}` as any)}>{text}</a>
      ),
    },
    {
      title: '订单号',
      dataIndex: 'orderCode',
      key: 'orderCode',
      width: 150,
    },
    {
      title: '仓库',
      dataIndex: 'warehouseName',
      key: 'warehouseName',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const config = statusMap[status as keyof typeof statusMap]
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        )
      },
    },
    {
      title: '成本',
      dataIndex: 'totalCost',
      key: 'totalCost',
      width: 100,
      align: 'right',
      render: (value) => `¥${value.toFixed(2)}`,
    },
    {
      title: '利润',
      dataIndex: 'totalProfit',
      key: 'totalProfit',
      width: 100,
      align: 'right',
      render: (value) => (
        <span style={{ color: value >= 0 ? 'green' : 'red', fontWeight: 'bold' }}>
          ¥{value.toFixed(2)}
        </span>
      ),
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 150,
      render: (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => {
        const { status } = record
        return (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => router.push(`/admin/stock-out/${record.id}` as any)}
            >
              查看
            </Button>
            {status === 'PENDING' && (
              <>
                <Button
                  type="link"
                  size="small"
                  onClick={() => handleComplete(record)}
                  loading={loading}
                >
                  确认出库
                </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  onClick={() => handleCancel(record)}
                  loading={loading}
                >
                  取消
                </Button>
              </>
            )}
          </Space>
        )
      },
    },
  ]

  const totalProfit = initialData.data.reduce((sum, item) => sum + item.totalProfit, 0)
  const totalCost = initialData.data.reduce((sum, item) => sum + item.totalCost, 0)

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总成本"
              value={totalCost}
              prefix="¥"
              precision={2}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总利润"
              value={totalProfit}
              prefix="¥"
              precision={2}
              valueStyle={{ color: totalProfit >= 0 ? '#3f8600' : '#cf1322' }}
              suffix={<DollarOutlined style={{ fontSize: 14 }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="记录数" value={initialData.total} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待出库"
              value={initialData.data.filter((item) => item.status === 'PENDING').length}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }} size="middle">
          <Search
            placeholder="搜索单号或订单号"
            allowClear
            defaultValue={searchKeyword}
            style={{ width: 200 }}
            onSearch={handleSearch}
            enterButton={<SearchOutlined />}
          />
          <Select
            placeholder="选择状态"
            allowClear
            style={{ width: 120 }}
            onChange={handleStatusChange}
          >
            <Select.Option value="PENDING">待出库</Select.Option>
            <Select.Option value="COMPLETED">已出库</Select.Option>
            <Select.Option value="CANCELLED">已取消</Select.Option>
          </Select>
          <Select
            placeholder="选择仓库"
            allowClear
            style={{ width: 150 }}
            onChange={handleWarehouseChange}
          >
            {warehouses.map((wh) => (
              <Select.Option key={wh.id} value={wh.id}>
                {wh.name}
              </Select.Option>
            ))}
          </Select>
          <RangePicker
            style={{ width: 250 }}
            onChange={handleDateRangeChange}
            placeholder={['开始日期', '结束日期']}
          />
        </Space>

        <Table
          columns={columns}
          dataSource={initialData.data}
          rowKey="id"
          pagination={{
            current: initialData.page,
            pageSize: initialData.pageSize,
            total: initialData.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              buildUrl({ page: page.toString(), pageSize: pageSize?.toString() })
            },
          }}
          scroll={{ x: 1400 }}
        />
      </Card>
    </div>
  )
}
