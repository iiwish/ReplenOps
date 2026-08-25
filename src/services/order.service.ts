import { prisma } from '@/lib/prisma'
import { OrderStatus, Prisma } from '@prisma/client'
import type { AuthUser } from '@/lib/auth'
import { lockOrderInventory, releaseOrderInventory } from './inventory-lock.service'
import {
  assertCanOperateStore,
  assertCanReadStore,
  canReadAllStores,
  getAccessibleStoreIds,
} from '@/lib/store-access'
import { buildGoodsSnapshot, resolveGoodsSnapshot } from '@/lib/goods-snapshot'
import { getShanghaiDateRange } from '@/lib/shanghai-time'
import { documentNumberService } from './document-number.service'
import { orderingScheduleService } from './ordering-schedule.service'
import { getUserDisplayNameMap, resolveUserDisplayName } from './user-display.service'

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.APPROVED,
  OrderStatus.PROCESSING,
]

// 列表参数接口
export interface ListOrderParams {
  page?: number
  pageSize?: number
  keyword?: string // 搜索关键词（单号、备注）
  status?: string | string[] // 状态筛选
  storeId?: string // 门店筛选
  startDate?: string // 开始日期
  endDate?: string // 结束日期
  user?: AuthUser // 当前用户，用于门店级数据权限
}

// 创建订单 DTO
export interface CreateOrderDto {
  storeId: string
  items: Array<{
    goodsId: string
    quantity: number
    unitPrice: number
  }>
  remark?: string
  createdBy: string
}

// 撤回订单时用于恢复购物车的商品结构
// goodsId 为 string，与 CartItem / useCartStore 保持一致
export interface CartRestoreItem {
  goodsId: string
  code: string
  name: string
  spec: string | null
  unit: string
  measureType: string
  price: number
  quantity: number
  availableQty: number
  imageUrl: string | null
}

// 订单列表项接口
export interface OrderListItem {
  id: string
  code: string
  storeId: string
  storeName: string
  status: string
  totalAmount: number
  remark: string | null
  createdBy: string
  createdByName: string
  approvedBy: string | null
  approvedByName: string | null
  approvedAt: Date | null
  completedAt: Date | null
  orderedAt: Date
  createdAt: Date
  updatedAt: Date
}

// 分页返回结果
export interface PaginatedOrderResult {
  data: OrderListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  statusCounts: Record<string, number>
}

// 订单详情接口
export interface OrderDetail {
  id: string
  code: string
  storeId: string
  storeName: string
  status: string
  totalAmount: number
  remark: string | null
  createdBy: string
  createdByName: string
  approvedBy: string | null
  approvedByName: string | null
  approvedAt: Date | null
  completedAt: Date | null
  orderedAt: Date
  stockOut: {
    id: string
    code: string
    status: string
    completedAt: Date | null
  } | null
  revokedBy: string | null
  revokedByName: string | null
  revokedAt: Date | null
  revokeReason: string | null
  createdAt: Date
  updatedAt: Date
  items: Array<{
    id: string
    goodsId: string
    goodsCode: string
    goodsName: string
    goodsSpec: string | null
    goodsUnit: string
    measureType: string
    categoryId: string
    categoryName: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
}

export class OrderService {
  /**
   * 创建订单
   */
  async create(dto: CreateOrderDto) {
    await orderingScheduleService.assertWithinOrderingTime()

    // 计算总金额
    const totalAmount = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

    return await prisma.$transaction(async (tx) => {
      const storeIdInt = Number.parseInt(dto.storeId, 10)
      const store = await tx.store.findFirst({
        where: { id: storeIdInt, isDeleted: false, isActive: true },
        select: { name: true },
      })
      if (!store) {
        throw new Error('门店不存在或未启用')
      }

      // Serialize order creation per store so concurrent submissions cannot bypass the one-active-order rule.
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "stores" WHERE "id" = ${storeIdInt} FOR UPDATE`
      )

      const activeOrder = await tx.order.findFirst({
        where: {
          storeId: storeIdInt,
          status: { in: ACTIVE_ORDER_STATUSES },
          isDeleted: false,
          createdBy: { not: 'migration' },
        },
        select: { code: true },
        orderBy: { orderedAt: 'desc' },
      })

      if (activeOrder) {
        throw new Error(`门店已有待处理订单 ${activeOrder.code}，请在确认收货后再下单`)
      }

      const lockedWarehouseId = await lockOrderInventory(
        tx,
        dto.items.map((item) => ({
          goodsId: Number.parseInt(item.goodsId, 10),
          quantity: item.quantity,
        }))
      )

      const goodsIds = Array.from(
        new Set(dto.items.map((item) => Number.parseInt(item.goodsId, 10)))
      )
      const goodsList = await tx.goods.findMany({
        where: { id: { in: goodsIds }, isDeleted: false, isActive: true },
        include: { category: { select: { name: true } } },
      })
      if (goodsList.length !== goodsIds.length) {
        throw new Error('部分商品不存在或未启用')
      }
      const goodsMap = new Map(goodsList.map((goods) => [goods.id, goods]))
      const code = await documentNumberService.next('ORDER', tx)

      const order = await tx.order.create({
        data: {
          code,
          storeId: storeIdInt,
          storeNameSnapshot: store.name,
          totalAmount,
          remark: dto.remark,
          createdBy: dto.createdBy,
          status: 'PENDING',
          lockedWarehouseId,
          items: {
            create: dto.items.map((item) => {
              const goodsId = Number.parseInt(item.goodsId, 10)
              const goods = goodsMap.get(goodsId)
              if (!goods) {
                throw new Error('商品不存在或未启用')
              }
              return {
                goodsId,
                ...buildGoodsSnapshot(goods),
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.quantity * item.unitPrice,
              }
            }),
          },
        },
        include: {
          items: {
            include: {
              goods: true,
            },
          },
          store: true,
        },
      })

      // 3. 记录容器跟踪（如果需要的话，这里暂时注释掉）
      // await tx.containerTracking.create({
      //   data: {
      //     orderId: order.id,
      //     storeId: dto.storeId,
      //     status: 'CREATED',
      //   },
      // })

      return order
    })
  }

  /**
   * 获取门店当前由本系统创建的待处理订单。
   * 历史迁移订单不参与“一店一单”限制，避免存量待审批数据阻塞新流程。
   */
  async getActiveOrderForStore(storeId: string, user: AuthUser) {
    const storeIdInt = Number.parseInt(storeId, 10)
    if (Number.isNaN(storeIdInt)) {
      throw new Error('门店ID无效')
    }

    await assertCanOperateStore(user, storeIdInt)

    const order = await prisma.order.findFirst({
      where: {
        storeId: storeIdInt,
        status: { in: ACTIVE_ORDER_STATUSES },
        isDeleted: false,
        createdBy: { not: 'migration' },
      },
      select: {
        id: true,
        code: true,
        status: true,
      },
      orderBy: { orderedAt: 'desc' },
    })

    return order
      ? {
          id: String(order.id),
          code: order.code,
          status: order.status,
        }
      : null
  }

  /**
   * 获取订单列表
   */
  async list(params: ListOrderParams): Promise<PaginatedOrderResult> {
    const { page = 1, pageSize = 20, keyword, status, storeId, startDate, endDate, user } = params

    const where: Prisma.OrderWhereInput = {
      isDeleted: false,
    }

    // 关键词搜索
    if (keyword) {
      where.OR = [
        { code: { contains: keyword, mode: 'insensitive' } },
        { remark: { contains: keyword, mode: 'insensitive' } },
      ]
    }

    // 状态筛选支持管理端和移动端按业务阶段传入一个或多个状态。
    const requestedStatuses = Array.isArray(status) ? status : status ? [status] : []
    if (requestedStatuses.length > 0) {
      const validStatuses = requestedStatuses.filter((value): value is OrderStatus =>
        Object.values(OrderStatus).includes(value as OrderStatus)
      )
      where.status = { in: validStatuses }
    }

    // 门店筛选
    if (storeId) {
      const storeIdInt = Number.parseInt(storeId, 10)
      if (Number.isNaN(storeIdInt)) {
        throw new Error('门店ID无效')
      }

      if (user) {
        await assertCanReadStore(user, storeIdInt)
      }

      where.storeId = storeIdInt
    } else if (user && !canReadAllStores(user)) {
      const accessibleStoreIds = await getAccessibleStoreIds(user)
      where.storeId = { in: accessibleStoreIds }
    }

    // 日期范围筛选
    if (startDate || endDate) {
      const range = getShanghaiDateRange(startDate, endDate)
      where.orderedAt = {
        ...(range.start ? { gte: range.start } : {}),
        ...(range.endExclusive ? { lt: range.endExclusive } : {}),
      }
    }

    // 查询总数
    const total = await prisma.order.count({ where })

    const statusCountsWhere = { ...where }
    delete statusCountsWhere.status
    const statusGroups = await prisma.order.groupBy({
      by: ['status'],
      where: statusCountsWhere,
      _count: { _all: true },
    })
    const statusCounts: Record<string, number> = {}
    for (const group of statusGroups) {
      statusCounts[group.status] = group._count._all
    }

    // 查询列表
    const orders = await prisma.order.findMany({
      where,
      include: {
        store: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        orderedAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    const userNames = await getUserDisplayNameMap(
      orders.flatMap((order) => [order.createdBy, order.approvedBy])
    )

    const data: OrderListItem[] = orders.map((order) => ({
      id: String(order.id),
      code: order.code,
      storeId: String(order.storeId),
      storeName: order.storeNameSnapshot ?? order.store.name,
      status: order.status,
      totalAmount: order.totalAmount.toNumber(),
      remark: order.remark,
      createdBy: order.createdBy,
      createdByName: resolveUserDisplayName(order.createdBy, userNames) ?? order.createdBy,
      approvedBy: order.approvedBy,
      approvedByName: resolveUserDisplayName(order.approvedBy, userNames),
      approvedAt: order.approvedAt,
      completedAt: order.completedAt,
      orderedAt: order.orderedAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }))

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      statusCounts,
    }
  }

  /**
   * 获取订单详情
   */
  async getById(id: string, user?: AuthUser): Promise<OrderDetail | null> {
    const orderId = Number.parseInt(id, 10)

    const order = await prisma.order.findFirst({
      where: { id: orderId, isDeleted: false },
      include: {
        store: {
          select: {
            name: true,
          },
        },
        items: {
          include: {
            goods: {
              select: {
                code: true,
                name: true,
                unit: true,
                measureType: true,
                spec: true,
                categoryId: true,
                category: { select: { name: true } },
              },
            },
          },
        },
        stockOut: {
          select: {
            id: true,
            code: true,
            status: true,
            completedAt: true,
          },
        },
      },
    })

    if (!order) return null

    if (user) {
      await assertCanReadStore(user, order.storeId)
    }

    const userNames = await getUserDisplayNameMap([
      order.createdBy,
      order.approvedBy,
      order.revokedBy,
    ])

    return {
      id: String(order.id),
      code: order.code,
      storeId: String(order.storeId),
      storeName: order.storeNameSnapshot ?? order.store.name,
      status: order.status,
      totalAmount: order.totalAmount.toNumber(),
      remark: order.remark,
      createdBy: order.createdBy,
      createdByName: resolveUserDisplayName(order.createdBy, userNames) ?? order.createdBy,
      approvedBy: order.approvedBy,
      approvedByName: resolveUserDisplayName(order.approvedBy, userNames),
      approvedAt: order.approvedAt,
      completedAt: order.completedAt,
      orderedAt: order.orderedAt,
      stockOut: order.stockOut
        ? {
            id: String(order.stockOut.id),
            code: order.stockOut.code,
            status: order.stockOut.status,
            completedAt: order.stockOut.completedAt,
          }
        : null,
      revokedBy: order.revokedBy,
      revokedByName: resolveUserDisplayName(order.revokedBy, userNames),
      revokedAt: order.revokedAt,
      revokeReason: order.revokeReason,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map((item) => {
        const snapshot = resolveGoodsSnapshot(item, item.goods)
        return {
          id: String(item.id),
          goodsId: String(item.goodsId),
          goodsCode: snapshot.goodsCodeSnapshot,
          goodsName: snapshot.goodsNameSnapshot,
          goodsSpec: snapshot.goodsSpecSnapshot,
          goodsUnit: snapshot.goodsUnitSnapshot,
          measureType: snapshot.measureTypeSnapshot,
          categoryId: String(snapshot.categoryIdSnapshot),
          categoryName: snapshot.categoryNameSnapshot,
          quantity: item.quantity.toNumber(),
          unitPrice: item.unitPrice.toNumber(),
          totalPrice: item.totalPrice.toNumber(),
        }
      }),
    }
  }

  /**
   * 移动端确认收货。
   * 仓库确认出库后订单进入待收货状态，门店确认收货只完成订单，不再处理库存。
   */
  async confirmReceipt(id: string, user: AuthUser): Promise<void> {
    const orderId = Number.parseInt(id, 10)

    const order = await prisma.order.findFirst({
      where: { id: orderId, isDeleted: false },
      include: {
        stockOut: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    })

    if (!order) {
      throw new Error('订单不存在')
    }

    await assertCanOperateStore(user, order.storeId)

    if (order.status === 'APPROVED') {
      throw new Error('订单尚未发货，无法确认收货')
    }

    if (order.status !== 'PROCESSING') {
      throw new Error('只有待收货订单可以确认收货')
    }

    if (!order.stockOut) {
      throw new Error('订单未生成出库单，无法确认收货')
    }

    if (order.stockOut.status !== 'COMPLETED') {
      throw new Error('订单尚未完成出库，无法确认收货')
    }

    const stockOutId = order.stockOut.id

    await prisma.$transaction(async (tx) => {
      const received = await tx.order.updateMany({
        where: {
          id: orderId,
          status: 'PROCESSING',
          isDeleted: false,
          stockOut: { status: 'COMPLETED', isDeleted: false },
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      })

      if (received.count !== 1) {
        throw new Error('订单状态已变化，请刷新后重试')
      }

      await tx.approvalLog.create({
        data: {
          orderId,
          entityType: 'ORDER',
          entityId: String(orderId),
          action: 'CONFIRM_RECEIPT',
          reason: '门店确认收货',
          beforeJson: { status: order.status, stockOutId },
          afterJson: { status: 'COMPLETED' },
          operatedBy: user.id,
        },
      })
    })
  }

  /**
   * 撤回订单（移动端：软删除 + 返回商品信息用于恢复购物车）
   * 仅 PENDING / REJECTED 状态可撤回
   *
   * @returns 包含订单商品信息的 CartRestoreItem[]，供前端恢复购物车
   */
  async revokeOrder(id: number, user?: AuthUser): Promise<CartRestoreItem[]> {
    const order = await prisma.order.findFirst({
      where: { id, isDeleted: false },
    })

    if (!order) {
      throw new Error('订单不存在')
    }

    if (order.status !== 'PENDING' && order.status !== 'REJECTED') {
      throw new Error('只有待审批或已拒绝的订单可以撤回')
    }

    if (user) {
      await assertCanOperateStore(user, order.storeId)
    }

    // 查询订单明细 + 商品信息
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId: id, isDeleted: false },
      include: { goods: true },
    })

    if (orderItems.length === 0) {
      throw new Error('订单没有商品明细')
    }

    const goodsIds = orderItems.map((item) => item.goodsId)

    // 查询所有仓库中每个商品的总可用库存
    const inventories = await prisma.inventory.findMany({
      where: { goodsId: { in: goodsIds }, isDeleted: false },
    })

    // 按商品ID汇总可用库存
    const inventoryMap = new Map<number, number>()
    for (const inv of inventories) {
      const current = inventoryMap.get(inv.goodsId) || 0
      inventoryMap.set(inv.goodsId, current + inv.availableQuantity.toNumber())
    }

    // 构建恢复购物车的商品列表
    const restoredItems: CartRestoreItem[] = orderItems.map((item) => ({
      goodsId: String(item.goodsId),
      code: item.goods.code,
      name: item.goods.name,
      spec: item.goods.spec,
      unit: item.goods.unit,
      measureType: item.goods.measureType,
      price: item.unitPrice.toNumber(),
      quantity: item.quantity.toNumber(),
      availableQty: inventoryMap.get(item.goodsId) || 0,
      imageUrl: item.goods.imageUrl,
    }))

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: {
          id,
          status: order.status,
          isDeleted: false,
        },
        data: { isDeleted: true },
      })

      if (claimed.count !== 1) {
        throw new Error('订单状态已变化，请刷新后重试')
      }

      await releaseOrderInventory(
        tx,
        order.lockedWarehouseId,
        orderItems.map((item) => ({
          goodsId: item.goodsId,
          quantity: item.quantity,
        }))
      )

      await tx.order.update({
        where: { id },
        data: { lockedWarehouseId: null, updatedAt: new Date() },
      })
    })

    return restoredItems
  }

  /**
   * 删除订单（软删除）
   */
  async delete(id: string, _userId: string) {
    const orderId = Number.parseInt(id, 10)

    const order = await prisma.order.findFirst({
      where: { id: orderId, isDeleted: false },
    })

    if (!order) {
      throw new Error('订单不存在')
    }

    // 只能删除待审批或已拒绝的订单
    if (order.status !== 'PENDING' && order.status !== 'REJECTED') {
      throw new Error('只能删除待审批或已拒绝的订单')
    }

    return await prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: {
          id: orderId,
          status: order.status,
          isDeleted: false,
        },
        data: { isDeleted: true },
      })

      if (claimed.count !== 1) {
        throw new Error('订单状态已变化，请刷新后重试')
      }

      const orderItems = await tx.orderItem.findMany({
        where: { orderId, isDeleted: false },
      })

      await releaseOrderInventory(
        tx,
        order.lockedWarehouseId,
        orderItems.map((item) => ({
          goodsId: item.goodsId,
          quantity: item.quantity,
        }))
      )

      return await tx.order.update({
        where: { id: orderId },
        data: {
          lockedWarehouseId: null,
          updatedAt: new Date(),
        },
      })
    })
  }

  /**
   * 审批订单
   */
  async approve(id: string, userId: string, _comment?: string) {
    const { orderApprovalService } = await import('./order-approval.service')
    return await orderApprovalService.approve(id, userId, _comment)
  }

  /**
   * 拒绝订单
   */
  async reject(id: string, userId: string, reason: string) {
    const { orderApprovalService } = await import('./order-approval.service')
    return orderApprovalService.reject(id, userId, reason)
  }
}

// 导出单例
export const orderService = new OrderService()
