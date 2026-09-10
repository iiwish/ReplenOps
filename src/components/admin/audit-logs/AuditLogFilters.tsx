'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { DatePicker, Select, Input, Form } from 'antd'
import dayjs from 'dayjs'
import type { ListAuditLogsInput } from '@/types/audit-log.types'

const { RangePicker } = DatePicker

export interface AuditLogFiltersProps {
  onFiltersChange: (
    filters: Omit<ListAuditLogsInput, 'page' | 'pageSize'> & { page: number; pageSize: number }
  ) => void
  loading?: boolean
  operators: Array<{ id: string; name: string }>
  exportButton?: ReactNode
}

const actionOptions = [
  { label: '审批通过', value: 'approve' },
  { label: '审批拒绝', value: 'reject' },
  { label: '订单撤销', value: 'revoke' },
  { label: '创建订单', value: 'create' },
  { label: '创建用户', value: 'USER_CREATE' },
  { label: '修改用户', value: 'USER_UPDATE' },
  { label: '用户状态', value: 'USER_STATUS_UPDATE' },
  { label: '添加门店管理员', value: 'STORE_ADMIN_ADD' },
  { label: '移除门店管理员', value: 'STORE_ADMIN_REMOVE' },
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
  exportButton,
}: AuditLogFiltersProps) {
  const [form] = Form.useForm<FormValues>()
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const scheduleFilterChange = () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(handleFilterChange, 350)
  }

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Form
        form={form}
        layout="inline"
        size="small"
        className="min-w-0 flex-1"
        onValuesChange={scheduleFilterChange}
      >
        <Form.Item<FormValues> name="actions">
          <Select
            aria-label="操作类型"
            mode="multiple"
            placeholder="全部操作类型"
            allowClear
            options={actionOptions}
            style={{ width: 150 }}
            loading={loading}
          />
        </Form.Item>

        <Form.Item<FormValues> name="operatorId">
          <Select
            aria-label="操作人"
            placeholder="全部操作人"
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

        <Form.Item<FormValues> name="dateRange">
          <RangePicker
            aria-label="时间范围"
            placeholder={['开始日期', '结束日期']}
            style={{ width: 250 }}
          />
        </Form.Item>

        <Form.Item<FormValues> name="orderId">
          <Input aria-label="订单号" placeholder="请输入订单号" style={{ width: 180 }} />
        </Form.Item>
      </Form>
      {exportButton}
    </div>
  )
}
