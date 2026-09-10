'use client'

import { useCallback, useRef, useState } from 'react'
import { Card, Pagination, Button, Modal, message } from 'antd'
import { ExportOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
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
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const loadRequestId = useRef(0)
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
    const requestId = ++loadRequestId.current
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

      if (requestId !== loadRequestId.current) return

      if (result.success && result.data) {
        setData(result.data)
        setFilters(newFilters)
      } else {
        message.error(result.error || '加载失败')
      }
    } catch (error) {
      if (requestId !== loadRequestId.current) return
      console.error('加载审计日志失败:', error)
      message.error('加载审计日志失败')
    } finally {
      if (requestId === loadRequestId.current) setLoading(false)
    }
  }, [])

  const handleFiltersChange = useCallback(
    (newFilters: typeof filters) => {
      setFilters(newFilters)
      void loadData(newFilters)
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

  const openExportModal = () => {
    setExportModalOpen(true)
  }

  const confirmExport = async () => {
    setExporting(true)
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
        setExportModalOpen(false)
      } else {
        message.error(result.error || '导出失败')
      }
    } catch (error) {
      console.error('导出审计日志失败:', error)
      message.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  const exportDateRangeLabel =
    filters.startDate || filters.endDate
      ? `${filters.startDate ? dayjs(filters.startDate).format('YYYY-MM-DD') : '不限'} 至 ${filters.endDate ? dayjs(filters.endDate).format('YYYY-MM-DD') : '不限'}`
      : '全部日期'

  const exportButton = isSuperAdmin ? (
    <Button type="primary" icon={<ExportOutlined />} onClick={openExportModal} loading={exporting}>
      导出Excel
    </Button>
  ) : null

  return (
    <div className="admin-list-page">
      <Card variant="borderless" className="admin-list-card">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className="shrink-0">
            <AuditLogFilters
              onFiltersChange={handleFiltersChange}
              loading={loading}
              operators={operators}
              exportButton={exportButton}
            />
          </div>

          <div className="admin-list-table-frame">
            <AuditLogList data={data.data} loading={loading} />
          </div>

          <div className="flex shrink-0 justify-end border-t border-gray-200 pt-2">
            <Pagination
              current={data.page}
              pageSize={data.pageSize}
              total={data.total}
              showSizeChanger={false}
              showTotal={(total) => `共 ${total} 条`}
              onChange={handlePageChange}
            />
          </div>
        </div>
        <Modal
          open={exportModalOpen}
          title="确认导出"
          okText="确认导出"
          cancelText="取消"
          confirmLoading={exporting}
          onOk={() => void confirmExport()}
          onCancel={() => setExportModalOpen(false)}
        >
          <p>
            将导出当前筛选条件下的审计日志，时间范围：
            <strong>{exportDateRangeLabel}</strong>，是否继续？
          </p>
        </Modal>
      </Card>
    </div>
  )
}
