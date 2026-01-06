import { requirePageAccess } from '@/lib/rbac-server'
import { Card, Col, Row, Statistic } from 'antd'

export default async function DashboardPage() {
  // 验证用户权限
  const { user } = await requirePageAccess('/admin/dashboard')

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>工作台</h1>
        <p style={{ color: '#999', marginTop: 8 }}>
          欢迎回来，{user.displayName || user.name}！
        </p>
      </div>

      {/* 数据统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="总销售额"
              value={112893}
              precision={2}
              suffix="元"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic title="订单总数" value={8846} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic title="库存商品" value={1234} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic title="活跃用户" value={328} />
          </Card>
        </Col>
      </Row>

      {/* 趋势卡片 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12}>
          <Card title="本周销售趋势" variant="borderless">
            <Statistic
              title="较上周"
              value={11.28}
              precision={2}
              suffix="%"
            />
            <p style={{ marginTop: 16, color: '#666' }}>周同比增长率</p>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title="库存预警" variant="borderless">
            <Statistic title="低库存商品" value={9} suffix="个" />
            <p style={{ marginTop: 16, color: '#666' }}>需要及时补货</p>
          </Card>
        </Col>
      </Row>

      {/* 快捷操作 */}
      <Card title="快捷操作" variant="borderless" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={6}>
            <Card
              variant="borderless"
              hoverable
              style={{ textAlign: 'center' }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
              <div>新增入库</div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              variant="borderless"
              hoverable
              style={{ textAlign: 'center' }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
              <div>创建订单</div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              variant="borderless"
              hoverable
              style={{ textAlign: 'center' }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
              <div>用户管理</div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              variant="borderless"
              hoverable
              style={{ textAlign: 'center' }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
              <div>财务报表</div>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  )
}
