'use client'

import { useState, useEffect } from 'react'
import { Table, Card, Form, Select, DatePicker, Button, Space, Tag, message } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getReturnLogs } from '@/actions/container-return-actions'

interface LogsResult {
  data: LogItem[]
  total: number
}

interface StoreListItem {
  id: string
  code: string
  name: string
}

interface LogItem {
  id: string
  containerTrackingId: string
  orderId: string | null
  orderCode: string | null
  opType: string
  quantity: number
  beforeBorrowed: number
  afterBorrowed: number
  remark: string | null
  operatedBy: string
  operatedAt: Date
  storeName: string
  containerName: string
}

interface ContainerReturnListProps {
  storeId?: string
  containerId?: string
  canWriteStock: boolean
}

export function ContainerReturnList({
  storeId,
  containerId,
  canWriteStock,
}: ContainerReturnListProps) {
  const [form] = Form.useForm()
  const [stores, setStores] = useState<StoreListItem[]>([])
  const [containers, setContainers] = useState<Array<{ id: string; name: string }>>([])
  const [logs, setLogs] = useState<LogItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const loadStores = async () => {
    try {
      const response = await fetch('/api/stores/user', {
        cache: 'no-store',
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          setStores(result.data)
        } else {
          message.error(result.message || '加载门店失败')
        }
      } else {
        message.error('加载门店失败')
      }
    } catch (error) {
      console.error('加载门店失败:', error)
      message.error('加载门店失败')
    }
  }

  const loadContainers = async () => {
    try {
      const response = await fetch('/api/containers', {
        cache: 'no-store',
      })

      if (response.ok) {
        const result = await response.json()
        setContainers(result || [])
      } else {
        message.error('加载包装物失败')
      }
    } catch (error) {
      console.error('加载包装物失败:', error)
      message.error('加载包装物失败')
    }
  }

  const loadLogs = async (currentPage = page, currentPageSize = pageSize) => {
    setLoading(true)
    try {
      const values = form.getFieldsValue()
      const result = await getReturnLogs({
        storeId: values.storeId,
        containerId: values.containerId,
        dateFrom: values.dateFrom ? values.dateFrom.format('YYYY-MM-DD') : undefined,
        dateTo: values.dateTo ? values.dateTo.format('YYYY-MM-DD') : undefined,
        page: currentPage,
        pageSize: currentPageSize,
      })

      if (result.success && result.data) {
        const data = result.data as LogsResult
        setLogs(data.data)
        setTotal(data.total)
      } else {
        message.error(result.message || '加载归还记录失败')
      }
    } catch (error) {
      console.error('加载归还记录失败:', error)
      message.error('加载归还记录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(1)
    loadLogs(1, pageSize)
  }

  const handleReset = () => {
    form.resetFields()
    setPage(1)
    loadLogs(1, pageSize)
  }

  const columns: ColumnsType<LogItem> = [
    {
      title: '归还时间',
      dataIndex: 'operatedAt',
      width: 160,
      render: (date: Date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '门店名称',
      dataIndex: 'storeName',
      width: 120,
    },
    {
      title: '包装物名称',
      dataIndex: 'containerName',
      width: 120,
    },
    {
      title: '归还数量',
      dataIndex: 'quantity',
      width: 100,
      render: (qty: number) => <Tag color="green">{qty} 个</Tag>,
    },
    {
      title: '变动情况',
      width: 150,
      render: (_: unknown, record: LogItem) => (
        <span>
          <span style={{ color: '#999' }}>{record.beforeBorrowed}</span>
          <span style={{ margin: '0 8px' }}>→</span>
          <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{record.afterBorrowed}</span>
        </span>
      ),
    },
    {
      title: '关联订单',
      dataIndex: 'orderCode',
      width: 120,
      render: (code: string | null) => (code ? <Tag color="blue">{code}</Tag> : <Tag>无</Tag>),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      ellipsis: true,
      render: (remark: string | null) => remark || '-',
    },
  ]

  useEffect(() => {
    loadStores()
    loadContainers()
    loadLogs()
  }, [])

  useEffect(() => {
    if (storeId || containerId) {
      form.setFieldsValue({ storeId, containerId })
      loadLogs(1, pageSize)
    }
  }, [storeId, containerId])

  return (
    <Card>
      <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="storeId">
          <Select
            placeholder="选择门店"
            style={{ width: 150 }}
            allowClear
            showSearch
            options={stores.map((s) => ({ label: s.name, value: s.id }))}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <Form.Item name="containerId">
          <Select
            placeholder="选择包装物"
            style={{ width: 150 }}
            allowClear
            showSearch
            options={containers.map((c) => ({ label: c.name, value: c.id }))}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <Form.Item name="dateFrom">
          <DatePicker placeholder="开始日期" style={{ width: 150 }} />
        </Form.Item>

        <Form.Item name="dateTo">
          <DatePicker placeholder="结束日期" style={{ width: 150 }} />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" onClick={handleSearch}>
              查询
            </Button>
            <Button onClick={handleReset}>重置</Button>
            <Button icon={<ReloadOutlined />} onClick={() => loadLogs()}>
              刷新
            </Button>
            {canWriteStock && (
              <Button type="primary" icon={<PlusOutlined />} href="/admin/container-return/new">
                登记归还
              </Button>
            )}
          </Space>
        </Form.Item>
      </Form>

      <Table
        columns={columns}
        dataSource={logs}
        loading={loading}
        rowKey="id"
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (newPage, newPageSize) => {
            setPage(newPage)
            setPageSize(newPageSize || 20)
            loadLogs(newPage, newPageSize || 20)
          },
        }}
      />
    </Card>
  )
}
