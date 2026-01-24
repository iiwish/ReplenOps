import { requirePageAccess } from '@/lib/rbac-server'
import { Card, Col, Row, Statistic } from 'antd'
import { getAdminDashboardData } from '@/actions/dashboard-actions'
import { QuickActions } from '@/components/admin/dashboard/QuickActions'

export default async function DashboardPage() {
  const { user } = await requirePageAccess('/admin/dashboard')

  const result = await getAdminDashboardData()

  if (!result.success || !result.data) {
    return (
      <div>
        <h1>工作台</h1>
        <p>加载数据失败: {result.message}</p>
      </div>
    )
  }

  const { todayStats, salesTrend, totalSales, totalOrders, totalGoods, totalUsers } = result.data

  const calculateWeeklyGrowth = () => {
    if (salesTrend.length < 2) return 0

    const currentWeek = salesTrend.slice(-7).reduce((sum, day) => sum + day.amount, 0)
    const previousWeek = salesTrend.slice(-14, -7).reduce((sum, day) => sum + day.amount, 0)

    if (previousWeek === 0) return 0
    return ((currentWeek - previousWeek) / previousWeek) * 100
  }

  const weeklyGrowth = calculateWeeklyGrowth()

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>工作台</h1>
        <p style={{ color: '#999', marginTop: 8 }}>欢迎回来,{user.displayName || user.name}!</p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="今日销售额"
              value={todayStats.totalAmount}
              precision={2}
              suffix="元"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic title="今日订单" value={todayStats.orderCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic title="待处理" value={todayStats.pendingCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless">
            <Statistic title="库存预警" value={todayStats.lowStockCount} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12}>
          <Card title="总销售额" variant="borderless">
            <Statistic value={totalSales} precision={2} suffix="元" />
            <p style={{ marginTop: 16, color: '#666' }}>所有已完成订单</p>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title="总订单数" variant="borderless">
            <Statistic value={totalOrders} />
            <p style={{ marginTop: 16, color: '#666' }}>历史订单总量</p>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12}>
          <Card title="本周销售趋势" variant="borderless">
            <Statistic
              title="较上周"
              value={weeklyGrowth}
              precision={2}
              suffix="%"
              styles={{
                content: { color: weeklyGrowth >= 0 ? '#3f8600' : '#cf1322' },
              }}
            />
            <p style={{ marginTop: 16, color: '#666' }}>周同比增长率</p>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title="基础数据" variant="borderless">
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="商品数" value={totalGoods} />
              </Col>
              <Col span={12}>
                <Statistic title="门店数" value={totalUsers} />
              </Col>
            </Row>
            <p style={{ marginTop: 16, color: '#666' }}>系统基础信息</p>
          </Card>
        </Col>
      </Row>

      <Card title="快捷操作" variant="borderless" style={{ marginTop: 16 }}>
        <QuickActions
          actions={[
            { icon: '📦', title: '新增入库', path: '/admin/stock-in' },
            { icon: '🛒', title: '订单管理', path: '/admin/orders' },
            { icon: '📊', title: '库存查询', path: '/admin/inventory/query' },
            { icon: '📦', title: '包装物管理', path: '/admin/containers' },
          ]}
        />
      </Card>
    </div>
  )
}
