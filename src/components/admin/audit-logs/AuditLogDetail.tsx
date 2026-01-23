'use client'

import { Card, Descriptions, Tag, Space, Button } from 'antd'
import dayjs from 'dayjs'

export interface AuditLogDetailProps {
  log: any
  onBack: () => void
}

export function AuditLogDetail({ log, onBack }: AuditLogDetailProps) {
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

  return (
    <div className="space-y-4">
      <Space>
        <Button onClick={onBack}>返回</Button>
      </Space>

      <Card title="基本信息" className="mb-4">
        <Descriptions column={2} variant="outlined">
          <Descriptions.Item label="操作时间">
            {dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="操作类型">{getActionTag(log.action)}</Descriptions.Item>
          <Descriptions.Item label="操作人">{log.operatedBy}</Descriptions.Item>
          <Descriptions.Item label="IP地址">{log.operatorIp || '-'}</Descriptions.Item>
          <Descriptions.Item label="操作说明">{log.reason || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {log.orderCode && (
        <Card title="关联订单" className="mb-4">
          <Descriptions column={2} variant="outlined">
            <Descriptions.Item label="订单号">
              <Button
                type="link"
                onClick={() => (window as any).open(`/admin/orders/${log.orderId}`)}
              >
                {log.orderCode}
              </Button>
            </Descriptions.Item>
            <Descriptions.Item label="门店">{log.orderStore || '-'}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </div>
  )
}
