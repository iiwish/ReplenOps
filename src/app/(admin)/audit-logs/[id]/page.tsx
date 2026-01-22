'use client'

import { getAuditLogDetail } from '@/actions/audit-log-actions'
import { AuditLogDetail } from '@/components/admin/audit-logs/AuditLogDetail'
import { Spin, Button, Space, message } from 'antd'
import { useState, useEffect } from 'react'

export default function AuditLogDetailPage({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState<any>(null)

  const loadDetail = async () => {
    setLoading(true)
    try {
      const result = await getAuditLogDetail(params.id)
      if (result.success) {
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
  }

  useEffect(() => {
    loadDetail()
  }, [params.id])

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
