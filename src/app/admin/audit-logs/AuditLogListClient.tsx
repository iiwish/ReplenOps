'use client'

import { useState, useCallback } from 'react'
import { Card, Space, Pagination, Button, message } from 'antd'
import { ExportOutlined } from '@ant-design/icons'
import { AuditLogList } from '@/components/admin/audit-logs/AuditLogList'
import AuditLogFilters from '@/components/admin/audit-logs/AuditLogFilters'
import { listAuditLogs, exportAuditLogs } from '@/actions/audit-log-actions'
import type { PaginatedAuditLogResult } from '@/services/audit-log.service'

interface AuditLogListClientProps {
  initialData: PaginatedAuditLogResult
  isSuperAdmin: boolean
  operators: Array<{ id: string; name: string }>
}

export default function AuditLogListClient({
  initialData,
  isSuperAdmin,
  operators,
}: AuditLogListClientProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PaginatedAuditLogResult>(initialData)
  const [filters, setFilters] = useState<{
    page: number
    pageSize: number
    actions?: string[]
    operatorId?: string
    orderId?: string
    startDate?: string
    endDate?: string
  }>({
    page: 1,
    pageSize: 20,
  })

  const loadData = useCallback(async (newFilters: typeof filters) => {
    setLoading(true)
    try {
      const result = await listAuditLogs({
        page: newFilters.page,
        pageSize: newFilters.pageSize,
        actions: newFilters.actions,
        operatorId: newFilters.operatorId,
        orderId: newFilters.orderId,
        startDate: newFilters.startDate,
        endDate: newFilters.endDate,
      })

      if (result.success && result.data) {
        setData(result.data)
        setFilters(newFilters)
      } else {
        message.error(result.error || '加载失败')
      }
    } catch (error) {
      console.error('加载审计日志失败:', error)
      message.error('加载审计日志失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleFiltersChange = useCallback(
    (newFilters: typeof filters) => {
      loadData(newFilters)
    },
    [loadData]
  )

  const handlePageChange = useCallback(
    (page: number, pageSize: number) => {
      loadData({
        ...filters,
        page,
        pageSize,
      })
    },
    [filters, loadData]
  )

  const handleExport = async () => {
    setLoading(true)
    try {
      const result = await exportAuditLogs({
        page: 1,
        pageSize: 10000,
        actions: filters.actions,
        operatorId: filters.operatorId,
        orderId: filters.orderId,
        startDate: filters.startDate,
        endDate: filters.endDate,
      })

      if (result.success && result.data) {
        const { buffer, filename } = result.data
        const blob = new Blob([new Uint8Array(buffer)], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        message.success('导出成功')
      } else {
        message.error(result.error || '导出失败')
      }
    } catch (error) {
      console.error('导出审计日志失败:', error)
      message.error('导出失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Card variant="borderless">
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>审计日志</h1>
            {isSuperAdmin && (
              <Button
                type="primary"
                icon={<ExportOutlined />}
                onClick={handleExport}
                loading={loading}
              >
                导出Excel
              </Button>
            )}
          </div>

          <AuditLogFilters
            onFiltersChange={handleFiltersChange}
            loading={loading}
            operators={operators}
          />

          <AuditLogList data={data.data} loading={loading} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination
              current={data.page}
              pageSize={data.pageSize}
              total={data.total}
              showSizeChanger={false}
              showTotal={(total) => `共 ${total} 条`}
              onChange={handlePageChange}
            />
          </div>
        </Space>
      </Card>
    </div>
  )
}
