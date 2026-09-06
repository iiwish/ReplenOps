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
      label: '归还日志',
      children: <ContainerReturnList canWriteStock={canWriteStock} />,
    },
    {
      key: 'all',
      label: '门店台账',
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
    <div className="admin-list-page">
      <Tabs
        className="admin-list-tabs"
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
