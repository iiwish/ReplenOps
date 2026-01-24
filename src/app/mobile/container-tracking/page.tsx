'use client'

import { useState, useEffect } from 'react'
import { Card, Badge } from 'antd'
import type { TrackingItem } from '@/components/admin/containers/TrackingSummary'
import { listTracking } from '@/actions/container-tracking-query-actions'
import { useStoreSelectionStore } from '@/lib/stores/store-selection.store'

interface TrackingCardProps {
  tracking: TrackingItem
}

function TrackingCard({ tracking }: TrackingCardProps) {
  const warningColor = {
    danger: '#ff4d4f',
    warning: '#faad14',
    info: '#1890ff',
    none: '#52c41a',
  }

  return (
    <Card
      hoverable
      style={{
        marginBottom: 16,
        borderLeft: `4px solid ${warningColor[tracking.warningLevel]}`,
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>
          {tracking.containerName}
        </div>
        <div style={{ fontSize: 14, color: '#666' }}>{tracking.storeName}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>在外数量</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>
            {tracking.currentBorrowed}
            <span style={{ fontSize: 14, marginLeft: 4 }}>个</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>押金金额</div>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#cf1322' }}>
            ¥{tracking.depositAmount.toFixed(2)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>归还率</div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 'bold',
            color:
              tracking.returnRate < 60 ? 'red' : tracking.returnRate < 80 ? 'orange' : '#52c41a',
          }}
        >
          {tracking.returnRate.toFixed(1)}%
        </div>
      </div>

      {tracking.warningLevel !== 'none' && (
        <div style={{ marginTop: 12 }}>
          <Badge
            status={tracking.warningLevel === 'danger' ? 'error' : 'warning'}
            text={
              tracking.warningLevel === 'danger'
                ? '长期未归还'
                : tracking.warningLevel === 'warning'
                  ? '归还率较低'
                  : '需关注'
            }
          />
        </div>
      )}
    </Card>
  )
}

export default function MobileTrackingPage() {
  const { selectedStoreId, availableStores } = useStoreSelectionStore()
  const [trackings, setTrackings] = useState<TrackingItem[]>([])
  const [loading, setLoading] = useState(false)

  const selectedStore = availableStores.find((s) => s.id === selectedStoreId)

  const loadTrackings = async () => {
    if (!selectedStore?.id) {
      return
    }

    setLoading(true)
    try {
      const result = await listTracking({
        storeId: selectedStore.id,
        page: 1,
        pageSize: 100,
      })

      if (result.success && result.data) {
        const data = result.data as { data: TrackingItem[]; total: number }
        setTrackings(data.data)
      } else {
        alert(result.message || '加载台账失败')
      }
    } catch (error) {
      console.error('加载台账失败:', error)
      alert('加载台账失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTrackings()
  }, [selectedStore?.id])

  return (
    <div style={{ padding: '16px', minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0, flex: 1, textAlign: 'center' }}>包装物台账</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>加载中...</div>
      ) : trackings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>暂无台账数据</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          {trackings.map((tracking) => (
            <TrackingCard key={tracking.id} tracking={tracking} />
          ))}
        </div>
      )}
    </div>
  )
}
