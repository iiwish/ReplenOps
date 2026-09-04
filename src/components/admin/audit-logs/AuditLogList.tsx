'use client'

import { Table, Tag, Space, Button, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import type { AuditLogListItem } from '@/services/audit-log.service'

const { Text } = Typography

export interface AuditLogListProps {
  data: AuditLogListItem[]
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
      APPROVE: { color: 'green', label: '审批' },
      REJECT: { color: 'red', label: '拒绝' },
      GOODS_CREATE: { color: 'green', label: '创建商品' },
      GOODS_UPDATE: { color: 'blue', label: '修改商品' },
      GOODS_DELETE: { color: 'red', label: '删除商品' },
      GOODS_STATUS_CHANGE: { color: 'orange', label: '商品状态' },
      STOCK_OUT_COMPLETE: { color: 'green', label: '确认出库' },
      STOCK_OUT_CANCEL: { color: 'red', label: '取消出库' },
      STOCK_IN_APPROVE: { color: 'green', label: '审批入库' },
      STOCK_IN_REJECT: { color: 'red', label: '拒绝入库' },
      STOCK_IN_COMPLETE: { color: 'green', label: '确认入库' },
      STOCK_IN_CANCEL: { color: 'red', label: '取消入库' },
      USER_CREATE: { color: 'green', label: '创建用户' },
      USER_UPDATE: { color: 'blue', label: '修改用户' },
      USER_STATUS_UPDATE: { color: 'orange', label: '用户状态' },
      STORE_ADMIN_ADD: { color: 'green', label: '添加门店管理员' },
      STORE_ADMIN_REMOVE: { color: 'red', label: '移除门店管理员' },
    }
    const config = actionConfig[action] || { color: 'default', label: action }
    return <Tag color={config.color}>{config.label}</Tag>
  }

  const columns: ColumnsType<AuditLogListItem> = [
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: Date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
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
      dataIndex: 'operatorName',
      key: 'operatorName',
      width: 120,
      sorter: true,
    },
    {
      title: 'IP地址',
      dataIndex: 'operatorIp',
      key: 'operatorIp',
      width: 130,
      render: (ip: string | undefined) => (
        <Tooltip title={ip}>
          <Text ellipsis style={{ maxWidth: 120 }}>
            {ip || '-'}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '业务对象',
      dataIndex: 'orderCode',
      key: 'orderCode',
      width: 150,
      render: (code: string | undefined, record: AuditLogListItem) =>
        code ? (
          <Button
            type="link"
            size="small"
            onClick={() => router.push(`/admin/orders/${record.orderId}`)}
          >
            {code}
          </Button>
        ) : (
          <span>{`${record.entityType} #${record.entityId || '-'}`}</span>
        ),
    },
    {
      title: '订单门店',
      dataIndex: 'orderStore',
      key: 'orderStore',
      width: 100,
      sorter: true,
      render: (store: string | undefined) => store || '-',
    },
    {
      title: '操作说明',
      dataIndex: 'reason',
      key: 'reason',
      width: 200,
      render: (reason: string | undefined) => (
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
      render: (_: unknown, record: AuditLogListItem) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => router.push(`/admin/audit-logs/${record.id}`)}
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
