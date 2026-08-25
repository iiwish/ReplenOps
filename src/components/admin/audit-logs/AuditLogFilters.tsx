'use client'

import { Space, Button, DatePicker, Select, Card, Input, Form } from 'antd'
import dayjs from 'dayjs'
import type { ListAuditLogsInput } from '@/types/audit-log.types'

const { RangePicker } = DatePicker

export interface AuditLogFiltersProps {
  onFiltersChange: (
    filters: Omit<ListAuditLogsInput, 'page' | 'pageSize'> & { page: number; pageSize: number }
  ) => void
  loading?: boolean
  operators: Array<{ id: string; name: string }>
}

const actionOptions = [
  { label: '审批通过', value: 'approve' },
  { label: '审批拒绝', value: 'reject' },
  { label: '订单撤销', value: 'revoke' },
  { label: '创建订单', value: 'create' },
]

interface FormValues {
  actions?: string[]
  operatorId?: string
  dateRange?: [dayjs.Dayjs | null, dayjs.Dayjs | null]
  orderId?: string
}

export default function AuditLogFilters({
  onFiltersChange,
  loading = false,
  operators,
}: AuditLogFiltersProps) {
  const [form] = Form.useForm<FormValues>()

  const handleFilterChange = () => {
    const values = form.getFieldsValue()
    const filters: Omit<ListAuditLogsInput, 'page' | 'pageSize'> & {
      page: number
      pageSize: number
    } = {
      page: 1,
      pageSize: 20,
    }

    if (values.actions && values.actions.length > 0) {
      filters.actions = values.actions
    }

    if (values.operatorId) {
      filters.operatorId = values.operatorId
    }

    if (values.dateRange) {
      const [start, end] = values.dateRange
      filters.startDate = start ? start.toDate().toISOString() : undefined
      filters.endDate = end ? end.toDate().toISOString() : undefined
    }

    if (values.orderId) {
      filters.orderId = values.orderId
    }

    onFiltersChange(filters)
  }

  const handleReset = () => {
    form.resetFields()
    onFiltersChange({
      page: 1,
      pageSize: 20,
    })
  }

  return (
    <Card title="筛选条件" size="small">
      <Form form={form} layout="inline" size="small">
        <Form.Item<FormValues> name="actions" label="操作类型">
          <Select
            mode="multiple"
            placeholder="全部"
            allowClear
            options={actionOptions}
            style={{ width: 150 }}
            loading={loading}
          />
        </Form.Item>

        <Form.Item<FormValues> name="operatorId" label="操作人">
          <Select
            placeholder="全部"
            allowClear
            showSearch
            optionFilterProp="label"
            options={operators.map((operator) => ({
              label: operator.name,
              value: operator.id,
            }))}
            style={{ width: 150 }}
          />
        </Form.Item>

        <Form.Item<FormValues> name="dateRange" label="时间范围">
          <RangePicker placeholder={['开始日期', '结束日期']} style={{ width: 250 }} />
        </Form.Item>

        <Form.Item<FormValues> name="orderId" label="订单号">
          <Input placeholder="请输入订单号" style={{ width: 180 }} />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" onClick={handleFilterChange} loading={loading}>
              筛选
            </Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  )
}
