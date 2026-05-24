'use client'

import { getAuditLogDetail } from '@/actions/audit-log-actions'
import { AuditLogDetail } from '@/components/admin/audit-logs/AuditLogDetail'
import { Spin, Button, Space, message } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import type { AuditLogDetail as AuditLogDetailType } from '@/services/audit-log.service'

export default function AuditLogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState<AuditLogDetailType | null>(null)

  const loadDetail = useCallback(async () => {
    setLoading(true)
    try {
      const { id } = await params
      const result = await getAuditLogDetail(id)
      if (result.success && result.data) {
        setLog(result.data)
      } else {
        message.error(result.error || '加载失败')
      }
    } catch (error) {
      console.error('加载审计日志详情失败:', error)
      message.error('加载审计日志详情失败')
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const handleBack = () => {
    window.history.back()
  }

  if (loading || !log) {
    return <Spin spinning={loading} />
  }

  return (
    <div className="p-6">
      <Space className="mb-4">
        <Button onClick={handleBack}>返回列表</Button>
      </Space>

      <AuditLogDetail log={log} onBack={handleBack} />
    </div>
  )
}
