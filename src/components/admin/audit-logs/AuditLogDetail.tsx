'use client'

import { Card, Descriptions, Tag, Space, Button } from 'antd'
import dayjs from 'dayjs'
import type { AuditLogDetail as AuditLogDetailType } from '@/services/audit-log.service'

export interface AuditLogDetailProps {
  log: AuditLogDetailType
  onBack: () => void
}

export function AuditLogDetail({ log, onBack }: AuditLogDetailProps) {
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

  return (
    <div className="space-y-4">
      <Space>
        <Button onClick={onBack}>返回</Button>
      </Space>

      <Card title="基本信息" className="mb-4">
        <Descriptions column={2} bordered>
          <Descriptions.Item label="操作时间">
            {dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="操作类型">{getActionTag(log.action)}</Descriptions.Item>
          <Descriptions.Item label="操作人">{log.operatorName}</Descriptions.Item>
          <Descriptions.Item label="IP地址">{log.operatorIp || '-'}</Descriptions.Item>
          <Descriptions.Item label="操作说明">{log.reason || '-'}</Descriptions.Item>
          <Descriptions.Item label="业务对象">
            {log.entityType} #{log.entityId || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {log.orderCode && (
        <Card title="关联订单" className="mb-4">
          <Descriptions column={2} bordered>
            <Descriptions.Item label="订单号">
              <Button
                type="link"
                onClick={() =>
                  (window as unknown as { open: (url: string) => void }).open(
                    `/admin/orders/${log.orderId}`
                  )
                }
              >
                {log.orderCode}
              </Button>
            </Descriptions.Item>
            <Descriptions.Item label="门店">{log.orderStore || '-'}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {(log.beforeJson !== undefined || log.afterJson !== undefined) && (
        <Card title="数据变更" className="mb-4">
          <Descriptions column={1} bordered>
            <Descriptions.Item label="变更前">
              <pre className="m-0 whitespace-pre-wrap text-xs">
                {log.beforeJson === undefined ? '-' : JSON.stringify(log.beforeJson, null, 2)}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label="变更后">
              <pre className="m-0 whitespace-pre-wrap text-xs">
                {log.afterJson === undefined ? '-' : JSON.stringify(log.afterJson, null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </div>
  )
}
