'use client'

import type { Route } from 'next'
import { Tabs } from 'antd'
import { useRouter } from 'next/navigation'
import { ContainerReturnList } from '@/components/admin/containers/ContainerReturnList'
import ContainerTrackingClient from '../container-tracking/ContainerTrackingClient'
import ContainersListClient from './ContainersListClient'

export type ContainerWorkspaceView = 'outstanding' | 'returns' | 'all' | 'settings'

interface ContainerWorkspaceClientProps {
  initialView: ContainerWorkspaceView
  canWriteStock: boolean
  canManageContainers: boolean
}

export default function ContainerWorkspaceClient({
  initialView,
  canWriteStock,
  canManageContainers,
}: ContainerWorkspaceClientProps) {
  const router = useRouter()

  const items = [
    {
      key: 'outstanding',
      label: '在外包装物',
      children: (
        <ContainerTrackingClient canWriteStock={canWriteStock} initialHasUnreturned embedded />
      ),
    },
    {
      key: 'returns',
      label: '归还验收',
      children: <ContainerReturnList canWriteStock={canWriteStock} />,
    },
    {
      key: 'all',
      label: '全部台账',
      children: (
        <ContainerTrackingClient
          canWriteStock={canWriteStock}
          initialHasUnreturned={false}
          embedded
        />
      ),
    },
    ...(canManageContainers
      ? [
          {
            key: 'settings',
            label: '包装物设置',
            children: <ContainersListClient canManage />,
          },
        ]
      : []),
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>包装物</h1>
        <p style={{ color: '#666', margin: '8px 0 0' }}>
          优先处理门店在外包装物和归还验收，档案与商品关联集中在设置中维护。
        </p>
      </div>

      <Tabs
        activeKey={initialView}
        items={items}
        destroyOnHidden
        onChange={(key) => {
          const nextView = key as ContainerWorkspaceView
          router.replace(`/admin/containers?view=${nextView}` as Route, { scroll: false })
        }}
      />
    </div>
  )
}
