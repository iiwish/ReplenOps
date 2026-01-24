'use client'

import { Card, Col, Row } from 'antd'

interface QuickActionCardProps {
  icon: string
  title: string
  path: string
}

function QuickActionCard({ icon, title, path }: QuickActionCardProps) {
  const handleClick = () => {
    window.location.href = path
  }

  return (
    <Card variant="borderless" hoverable style={{ textAlign: 'center' }} onClick={handleClick}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div>{title}</div>
    </Card>
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
