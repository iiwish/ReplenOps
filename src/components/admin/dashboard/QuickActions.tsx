'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { Col, Row } from 'antd'
import {
  ContainerOutlined,
  DatabaseOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'

export type QuickActionIcon = 'stock-in' | 'orders' | 'inventory' | 'containers'

const icons: Record<QuickActionIcon, React.ReactNode> = {
  'stock-in': <DatabaseOutlined />,
  orders: <ShoppingCartOutlined />,
  inventory: <InboxOutlined />,
  containers: <ContainerOutlined />,
}

interface QuickActionCardProps {
  icon: QuickActionIcon
  title: string
  path: string
}

function QuickActionCard({ icon, title, path }: QuickActionCardProps) {
  return (
    <Link
      href={path as Route}
      style={{
        display: 'block',
        color: 'inherit',
        textAlign: 'center',
        padding: '16px 12px',
        border: '1px solid #f0f0f0',
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8, color: '#1677ff' }}>{icons[icon]}</div>
      <div>{title}</div>
    </Link>
  )
}

interface QuickActionsProps {
  actions: QuickActionCardProps[]
}

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <Row gutter={16}>
      {actions.map((action) => (
        <Col xs={24} sm={12} md={6} key={action.path}>
          <QuickActionCard {...action} />
        </Col>
      ))}
    </Row>
  )
}
