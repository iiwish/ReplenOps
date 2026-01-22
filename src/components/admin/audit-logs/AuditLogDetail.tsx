'use client'

import { Card, Descriptions, Tag, Space, Button, Typography, Alert } from 'antd'
import dayjs from 'dayjs'

const { Text, Paragraph } = Typography

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

  const formatData = (data: any, label: string) => {
    if (!data) return null
    return (
      <div className="space-y-2">
        <div className="mb-1 font-semibold">{label}:</div>
        <pre className="overflow-x-auto rounded bg-gray-50 p-2 text-sm">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    )
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
          <Descriptions.Item label="操作人">{log.operatorName || log.operatedBy}</Descriptions.Item>
          <Descriptions.Item label="IP地址">{log.operatorIp || '-'}</Descriptions.Item>
          <Descriptions.Item label="操作说明">{log.remark || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {log.orderCode && (
        <Card title="关联订单" className="mb-4">
          <Descriptions column={2} bordered>
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

      {(log.beforeData || log.afterData) && (
        <Card title="数据对比" className="mb-4">
          <Alert
            message="以下为操作前后的数据对比（如有）"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          {formatData(log.beforeData, '操作前')}
          {formatData(log.afterData, '操作后')}
        </Card>
      )}
    </div>
  )
}
