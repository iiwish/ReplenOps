import { requirePageAccess } from '@/lib/rbac-server'
import StockInFormClient from '../../StockInFormClient'
import { stockInService } from '@/services/stock-in.service'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditStockInPage({ params }: PageProps) {
  await requirePageAccess('/admin/stock-in')

  const { id } = await params

  try {
    // 获取入库单详情
    const stockIn = await stockInService.findById(id)

    // 只有PENDING状态的入库单才能编辑
    if (stockIn.status !== 'PENDING') {
      return (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <h2>该入库单不允许编辑</h2>
          <p>只有待审批状态的入库单才能编辑</p>
        </div>
      )
    }

    // 获取仓库列表
    const warehouses = await stockInService.getActiveWarehouses()

    // 转换数据格式
    const initialValues = {
      id: stockIn.id,
      warehouseId: stockIn.warehouseId,
      items: stockIn.items.map((item) => ({
        key: item.id,
        goodsId: item.goodsId,
        goodsCode: item.goodsCode,
        goodsName: item.goodsName,
        goodsUnit: item.goodsUnit,
        measureType: item.measureType,
        quantity: item.quantity,
        price: item.unitPrice,
        amount: item.totalPrice,
      })),
      remark: stockIn.remark || '',
    }

    return (
      <div>
        <h2 style={{ marginBottom: 24 }}>编辑入库单</h2>
        <StockInFormClient
          mode="edit"
          initialValues={initialValues}
          warehouses={warehouses}
        />
      </div>
    )
  } catch (error) {
    notFound()
  }
}
