'use client'

import { Table, Tag, Space, Button, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'

const { Text } = Typography

export interface AuditLogListProps {
  data: any[]
  loading?: boolean
}

export function AuditLogList({ data, loading = false }: AuditLogListProps) {
  const router = useRouter()

  const getActionTag = (action: string) => {
    const actionConfig: Record<string, { color: string; label: string }> = {
      approve: { color: 'green', label: '审批' },
      reject: { color: 'red', label: '拒绝' },
      revoke: { color: 'orange', label: '撤销' },
      adjust: { color: 'blue', label: '调整' },
    }
    const config = actionConfig[action] || { color: 'default', label: action }
    return <Tag color={config.color}>{config.label}</Tag>
  }

  const columns: ColumnsType<any> = [
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
      sorter: true,
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (action: string) => getActionTag(action),
      sorter: true,
    },
    {
      title: '操作人',
      dataIndex: 'operatedBy',
      key: 'operatedBy',
      width: 120,
      sorter: true,
    },
    {
      title: 'IP地址',
      dataIndex: 'operatorIp',
      key: 'operatorIp',
      width: 130,
      render: (ip: string) => (
        <Tooltip title={ip}>
          <Text ellipsis style={{ maxWidth: 120 }}>
            {ip}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '订单号',
      dataIndex: 'orderCode',
      key: 'orderCode',
      width: 150,
      render: (code: string, record: any) =>
        code ? (
          <Button
            type="link"
            size="small"
            onClick={() => router.push(`/admin/orders/${record.orderId}`)}
          >
            {code}
          </Button>
        ) : (
          <span>-</span>
        ),
    },
    {
      title: '订单门店',
      dataIndex: 'orderStore',
      key: 'orderStore',
      width: 100,
      sorter: true,
    },
    {
      title: '操作说明',
      dataIndex: 'reason',
      key: 'reason',
      width: 200,
      render: (reason: string) => (
        <Tooltip title={reason}>
          <Text ellipsis style={{ maxWidth: 180 }}>
            {reason || '-'}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => router.push(`/admin/audit-logs/${record.id}` as any)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      pagination={false}
      scroll={{ x: 1500 }}
      size="small"
    />
  )
}
