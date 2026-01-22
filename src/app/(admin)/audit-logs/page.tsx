'use client'

import { listAuditLogs, exportAuditLogs } from '@/actions/audit-log-actions'
import { type ListAuditLogsInput } from '@/types/audit-log.types'
import AuditLogFilters from '@/components/admin/audit-logs/AuditLogFilters'
import { AuditLogList } from '@/components/admin/audit-logs/AuditLogList'
import { Card, Space, Button, message } from 'antd'
import { useState, useEffect } from 'react'

export default function AuditLogsPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [filters, setFilters] = useState<ListAuditLogsInput>({
    page: 1,
    pageSize: 20,
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await listAuditLogs(filters)
      if (result.success && result.data) {
        setData(result.data.data)
      } else {
        message.error(result.error || '加载失败')
      }
    } catch (error) {
      console.error('加载审计日志失败:', error)
      message.error('加载审计日志失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [filters])

  const handleExport = async () => {
    try {
      const result = await exportAuditLogs(filters)
      if (result.success && result.data) {
        const { buffer, filename } = result.data

        const blob = new Blob([new Uint8Array(buffer)], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)

        message.success('导出成功')
      } else {
        message.error(result.error || '导出失败')
      }
    } catch (error) {
      console.error('导出审计日志失败:', error)
      message.error('导出审计日志失败')
    }
  }

  const handleFiltersChange = (newFilters: ListAuditLogsInput) => {
    setFilters(newFilters)
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <Space>
          <Button type="primary" onClick={handleExport} loading={loading}>
            导出Excel
          </Button>
        </Space>
      </div>

      <AuditLogFilters onFiltersChange={handleFiltersChange} loading={loading} />

      <Card>
        <AuditLogList data={data} loading={loading} />
      </Card>
    </div>
  )
}
