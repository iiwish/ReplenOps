import { requirePageAccess } from '@/lib/rbac-server'
import { Card, Col, Row, Statistic } from 'antd'
import type { Route } from 'next'
import { getAdminDashboardData } from '@/actions/dashboard-actions'
import { DashboardMetricLink } from '@/components/admin/dashboard/DashboardMetricLink'
import { QuickActions } from '@/components/admin/dashboard/QuickActions'
import { getShanghaiDate } from '@/lib/shanghai-time'
import { canPerformAction } from '@/lib/action-permissions'
import type { QuickActionIcon } from '@/components/admin/dashboard/QuickActions'

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

  const { todayStats, orderTrend, totalOrders, totalCompletedOrders, totalGoods, totalStores } =
    result.data

  const calculateWeeklyGrowth = () => {
    if (orderTrend.length < 14) return 0

    const currentWeek = orderTrend.slice(-7).reduce((sum, day) => sum + day.count, 0)
    const previousWeek = orderTrend.slice(-14, -7).reduce((sum, day) => sum + day.count, 0)

    if (previousWeek === 0) return 0
    return ((currentWeek - previousWeek) / previousWeek) * 100
  }

  const weeklyGrowth = calculateWeeklyGrowth()
  const today = getShanghaiDate()
  const todayOrdersHref = `/admin/orders?startDate=${today}&endDate=${today}` as Route
  const quickActions: Array<{ icon: QuickActionIcon; title: string; path: string }> = [
    ...(canPerformAction(user, 'stock:write')
      ? [{ icon: 'stock-in' as const, title: '新增入库', path: '/admin/stock-in/new' }]
      : []),
    { icon: 'orders', title: '订单管理', path: '/admin/orders' },
    ...(canPerformAction(user, 'stock:read')
      ? [
          { icon: 'inventory' as const, title: '库存查询', path: '/admin/inventory/query' },
          { icon: 'containers' as const, title: '包装物', path: '/admin/containers' },
        ]
      : []),
  ]

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>工作台</h1>
        <p style={{ color: '#999', marginTop: 8 }}>欢迎回来,{user.displayName || user.name}!</p>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <DashboardMetricLink
            href={todayOrdersHref}
            title="今日订单"
            value={todayStats.orderCount}
            compact
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DashboardMetricLink
            href={'/admin/orders?status=PENDING%2CAPPROVED%2CPROCESSING' as Route}
            title="待处理订单"
            value={todayStats.pendingCount}
            compact
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DashboardMetricLink
            href={'/admin/inventory/query?stockStatus=low_stock' as Route}
            title="库存预警"
            value={todayStats.lowStockCount}
            compact
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DashboardMetricLink
            href={'/admin/containers?view=outstanding' as Route}
            title="在外包装物"
            value={todayStats.containerToReturnCount}
            compact
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12}>
          <DashboardMetricLink
            href="/admin/orders"
            title="总订单数"
            value={totalOrders}
            description="历史订单总量"
          />
        </Col>
        <Col xs={24} sm={12}>
          <DashboardMetricLink
            href={'/admin/orders?status=COMPLETED' as Route}
            title="已完成订单"
            value={totalCompletedOrders}
            description="门店已确认收货"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12}>
          <Card title="本周订单趋势" variant="borderless">
            <Statistic
              title="较上周"
              value={weeklyGrowth}
              precision={2}
              suffix="%"
              styles={{
                content: { color: weeklyGrowth >= 0 ? '#3f8600' : '#cf1322' },
              }}
            />
            <p style={{ marginTop: 16, color: '#666' }}>较前七日订单量变化</p>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title="基础数据" variant="borderless">
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="商品数" value={totalGoods} />
              </Col>
              <Col span={12}>
                <Statistic title="门店数" value={totalStores} />
              </Col>
            </Row>
            <p style={{ marginTop: 16, color: '#666' }}>系统基础信息</p>
          </Card>
        </Col>
      </Row>

      <Card title="快捷操作" variant="borderless" style={{ marginTop: 16 }}>
        <QuickActions actions={quickActions} />
      </Card>
    </div>
  )
}
