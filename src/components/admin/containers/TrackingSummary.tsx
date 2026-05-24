'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  Statistic,
  message,
  Row,
  Col,
} from 'antd'
import { getTrackingSummary } from '@/actions/container-tracking-query-actions'

export interface TrackingItem {
  id: string
  storeId: string
  storeName: string
  containerId: string
  containerName: string
  containerCode: string
  containerUnit: string
  containerDeposit: number
  totalBorrowed: number
  totalReturned: number
  currentBorrowed: number
  returnRate: number
  depositAmount: number
  lastBorrowAt: Date | null
  lastReturnAt: Date | null
  daysUnreturned: number
  warningLevel: 'none' | 'info' | 'warning' | 'danger'
}

interface SummaryData {
  totalContainers: number
  totalBorrowed: number
  totalDeposit: number
  avgReturnRate: number
}

export function TrackingSummary({
  storeId,
  containerId,
}: {
  storeId?: string
  containerId?: string
}) {
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)

  const loadSummary = async () => {
    setLoading(true)
    try {
      const result = await getTrackingSummary({ storeId, containerId })
      if (result.success && result.data && typeof result.data === 'object') {
        setSummary(result.data as SummaryData)
      } else {
        message.error(result.message || '加载汇总统计失败')
      }
    } catch (error) {
      console.error('加载汇总统计失败:', error)
      message.error('加载汇总统计失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [storeId, containerId])

  if (!summary) return null

  return (
    <Row gutter={16}>
      <Col span={6}>
        <Card loading={loading}>
          <Statistic
            title="包装物种类"
            value={summary.totalContainers}
            suffix="种"
            styles={{ content: { color: '#1890ff' } }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card loading={loading}>
          <Statistic
            title="总在外数量"
            value={summary.totalBorrowed}
            styles={{ content: { color: '#faad14' } }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card loading={loading}>
          <Statistic
            title="押金总额"
            value={summary.totalDeposit}
            precision={2}
            prefix="¥"
            styles={{ content: { color: '#cf1322' } }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card loading={loading}>
          <Statistic
            title="平均归还率"
            value={summary.avgReturnRate}
            precision={1}
            suffix="%"
            styles={{ content: { color: '#52c41a' } }}
          />
        </Card>
      </Col>
    </Row>
  )
}
