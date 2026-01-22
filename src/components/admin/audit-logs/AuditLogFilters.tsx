'use client'

import { Space, Button, DatePicker, Select, Card, Input, Form } from 'antd'

const { RangePicker } = DatePicker

export interface AuditLogFiltersProps {
  onFiltersChange: (filters: any) => void
  loading?: boolean
}

const actionOptions = [
  { label: '审批通过', value: 'approve' },
  { label: '审批拒绝', value: 'reject' },
  { label: '订单撤销', value: 'revoke' },
  { label: '创建订单', value: 'create' },
]

export default function AuditLogFilters({
  onFiltersChange,
  loading = false,
}: AuditLogFiltersProps) {
  const [form] = Form.useForm()

  const handleFilterChange = () => {
    const values = form.getFieldsValue()
    const filters: any = {
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
        <Form.Item name="actions" label="操作类型">
          <Select
            mode="multiple"
            placeholder="全部"
            allowClear
            options={actionOptions}
            style={{ width: 150 }}
            loading={loading}
          />
        </Form.Item>

        <Form.Item name="operatorId" label="操作人ID">
          <Input placeholder="输入操作人ID" style={{ width: 150 }} />
        </Form.Item>

        <Form.Item name="dateRange" label="时间范围">
          <RangePicker placeholder={['开始日期', '结束日期']} style={{ width: 250 }} />
        </Form.Item>

        <Form.Item name="orderId" label="订单号">
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
