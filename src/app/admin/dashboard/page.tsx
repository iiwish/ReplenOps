import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  ChevronRight,
  ClipboardList,
  Package,
  RefreshCw,
  ShoppingCart,
  Truck,
  Warehouse,
} from 'lucide-react'
import { Card, Col, Empty, Row, Statistic, Tag } from 'antd'
import type { Route } from 'next'
import Link from 'next/link'
import { requirePageAccess } from '@/lib/rbac-server'
import { getAdminDashboardData } from '@/actions/dashboard-actions'
import { DashboardMetricLink } from '@/components/admin/dashboard/DashboardMetricLink'
import { InventoryMovementChart } from '@/components/admin/dashboard/InventoryMovementChart'
import { formatShanghaiDateTime, getShanghaiDate } from '@/lib/shanghai-time'

const formatQuantity = (value: number) =>
  value.toLocaleString('zh-CN', { maximumFractionDigits: 3 })

const formatCurrency = (value: number) =>
  `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const changeMeta = {
  IN: { label: '入库', color: 'green', icon: ArrowDownToLine },
  OUT: { label: '出库', color: 'red', icon: ArrowUpFromLine },
  RETURN: { label: '退回', color: 'blue', icon: RefreshCw },
  ADJUSTMENT: { label: '调整', color: 'orange', icon: RefreshCw },
} as const

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: typeof Package
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-gray-900">
      <Icon className="h-4 w-4 text-blue-600" aria-hidden="true" />
      {children}
    </span>
  )
}

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href as Route}
      className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
    >
      {children}
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  )
}

export default async function DashboardPage() {
  await requirePageAccess('/admin/dashboard')
  const result = await getAdminDashboardData()

  if (!result.success || !result.data) {
    return (
      <div>
        <p>加载数据失败: {result.message}</p>
      </div>
    )
  }

  const { todayStats, inventory, inventoryChanges, recentInventoryChanges, tasks } = result.data
  const today = getShanghaiDate()
  const todayOrdersHref = `/admin/orders?startDate=${today}&endDate=${today}` as Route

  const movementTotals = inventoryChanges.reduce(
    (summary, item) => ({
      inbound: summary.inbound + item.inbound,
      outbound: summary.outbound + item.outbound,
      netChange: summary.netChange + item.netChange,
    }),
    { inbound: 0, outbound: 0, netChange: 0 }
  )

  return (
    <div className="space-y-4">
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

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card
            title={<SectionTitle icon={ShoppingCart}>本月订单概况</SectionTitle>}
            extra={<PanelLink href="/admin/orders">查看订单</PanelLink>}
            className="h-full"
          >
            <Row gutter={[16, 20]}>
              <Col span={8}>
                <Statistic title="订单数" value={todayStats.monthlyOrderCount} />
              </Col>
              <Col span={8}>
                <Statistic title="已完成" value={todayStats.monthlyCompletedCount} />
              </Col>
              <Col span={8}>
                <Statistic title="待处理" value={todayStats.monthlyPendingCount} />
              </Col>
            </Row>
            <div className="mt-5 flex items-center gap-2 border-t border-gray-100 pt-4 text-sm text-gray-500">
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              以本月实际订单处理情况为准
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={<SectionTitle icon={Warehouse}>库存总览</SectionTitle>}
            extra={<PanelLink href="/admin/inventory/query">查看库存</PanelLink>}
            className="h-full"
          >
            <Row gutter={[16, 20]}>
              <Col span={12}>
                <Statistic title="总库存量" value={formatQuantity(inventory.totalQuantity)} />
              </Col>
              <Col span={12}>
                <Statistic title="库存金额" value={formatCurrency(inventory.totalValue)} />
              </Col>
              <Col span={12}>
                <Statistic title="可用库存" value={formatQuantity(inventory.availableQuantity)} />
              </Col>
              <Col span={12}>
                <Statistic title="锁定库存" value={formatQuantity(inventory.lockedQuantity)} />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={<SectionTitle icon={AlertTriangle}>库存风险</SectionTitle>}
            extra={
              <PanelLink href="/admin/inventory/query?stockStatus=low_stock">全部预警</PanelLink>
            }
            className="h-full"
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-3xl font-semibold leading-none text-red-600">
                  {inventory.lowStockCount}
                </div>
                <div className="mt-2 text-sm text-gray-500">预警项</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-semibold leading-none text-orange-500">
                  {inventory.zeroStockCount}
                </div>
                <div className="mt-2 text-sm text-gray-500">零库存项</div>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2 border-t border-gray-100 pt-4 text-sm text-gray-500">
              <Boxes className="h-4 w-4" aria-hidden="true" />
              优先处理零库存和缺口最大的商品
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={<SectionTitle icon={ArrowUpFromLine}>本月库存变化</SectionTitle>}
            extra={<PanelLink href="/admin/inventory/logs">查看变动记录</PanelLink>}
          >
            <div className="mb-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-2 text-gray-600">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                入库{' '}
                <strong className="text-gray-900">{formatQuantity(movementTotals.inbound)}</strong>
              </span>
              <span className="inline-flex items-center gap-2 text-gray-600">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                出库{' '}
                <strong className="text-gray-900">{formatQuantity(movementTotals.outbound)}</strong>
              </span>
              <span className="inline-flex items-center gap-2 text-gray-600">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                净变化{' '}
                <strong
                  className={movementTotals.netChange >= 0 ? 'text-green-600' : 'text-red-600'}
                >
                  {movementTotals.netChange >= 0 ? '+' : ''}
                  {formatQuantity(movementTotals.netChange)}
                </strong>
              </span>
            </div>
            <InventoryMovementChart data={inventoryChanges} />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={<SectionTitle icon={ClipboardList}>待处理作业</SectionTitle>}
            extra={<span className="text-xs text-gray-400">需要关注</span>}
            className="h-full"
          >
            <div className="divide-y divide-gray-100">
              {tasks.map((task) => (
                <Link
                  key={task.id}
                  href={task.href as Route}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span className="inline-flex items-center gap-3 text-sm text-gray-700">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      {task.id === 'pending-orders' ? (
                        <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                      ) : task.id === 'stock-in' ? (
                        <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                      ) : task.id === 'stock-out' ? (
                        <Truck className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Package className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    {task.label}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900">
                    {task.count}
                    <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={<SectionTitle icon={AlertTriangle}>重点预警</SectionTitle>}
            extra={
              <PanelLink href="/admin/inventory/query?stockStatus=low_stock">库存查询</PanelLink>
            }
            className="h-full max-h-[560px] overflow-hidden"
          >
            {inventory.lowStockItems.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有库存预警" />
            ) : (
              <div className="max-h-[440px] divide-y divide-gray-100 overflow-y-auto pr-1">
                {inventory.lowStockItems.map((item) => (
                  <Link
                    key={item.id}
                    href={
                      `/admin/inventory/query?stockStatus=low_stock&keyword=${encodeURIComponent(item.goodsCode)}` as Route
                    }
                    className="group block py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900 group-hover:text-blue-600">
                          {item.goodsName}
                        </div>
                        <div className="mt-1 truncate text-xs text-gray-500">
                          {item.warehouseName} · {item.goodsCode}
                        </div>
                      </div>
                      <Tag color={item.availableQuantity <= 0 ? 'red' : 'orange'}>
                        {item.availableQuantity <= 0 ? '零库存' : '低库存'}
                      </Tag>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>
                        可用 {formatQuantity(item.availableQuantity)} / 预警{' '}
                        {formatQuantity(item.minStock)}
                      </span>
                      <span className="font-medium text-red-600">
                        缺口 {formatQuantity(item.shortageQuantity)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={<SectionTitle icon={RefreshCw}>最近库存变动</SectionTitle>}
            extra={<PanelLink href="/admin/inventory/logs">全部记录</PanelLink>}
            className="h-full max-h-[560px] overflow-hidden"
          >
            {recentInventoryChanges.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无库存变动记录" />
            ) : (
              <div className="max-h-[440px] divide-y divide-gray-100 overflow-y-auto pr-1">
                {recentInventoryChanges.map((change) => {
                  const meta =
                    changeMeta[change.changeType as keyof typeof changeMeta] ??
                    changeMeta.ADJUSTMENT
                  const Icon = meta.icon
                  return (
                    <div
                      key={change.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-500">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm text-gray-800">
                            {change.goodsName}{' '}
                            <span className="text-gray-400">· {change.warehouseName}</span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {formatShanghaiDateTime(change.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <Tag color={meta.color}>{meta.label}</Tag>
                        <div className="mt-1 text-sm font-medium text-gray-700">
                          {formatQuantity(change.quantity)} {change.goodsUnit}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
