import dayjs from 'dayjs'
import { requirePageAccess } from '@/lib/rbac-server'
import { stockOutService } from '@/services/stock-out.service'
import { PrintButton } from '@/components/admin/stock-out/PrintButton'

const statusLabels: Record<string, string> = {
  PENDING: '待出库',
  COMPLETED: '已出库',
  CANCELLED: '已取消',
}

const formatAmount = (value: number) =>
  value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export default async function StockOutPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess('/admin/stock-out')
  const { id } = await params
  const stockOut = await stockOutService.findById(id)

  if (!stockOut) {
    return <div className="p-8 text-center">出库单不存在或已删除</div>
  }

  const totalQuantity = stockOut.items.reduce((sum, item) => sum + item.quantity, 0)
  const totalAmount = stockOut.items.reduce((sum, item) => sum + item.lineAmount, 0)

  return (
    <div className="stock-out-print-page mx-auto max-w-[210mm] bg-white text-black">
      <div className="stock-out-print-actions mb-6 flex justify-end">
        <PrintButton />
      </div>

      <header className="mb-6 border-b-2 border-black pb-4 text-center">
        <h1 className="text-2xl font-bold">出库单</h1>
        <p className="mt-2 text-sm">单号：{stockOut.code}</p>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
        <div>订单号：{stockOut.orderCode}</div>
        <div>门店：{stockOut.storeName}</div>
        <div>出库仓库：{stockOut.warehouseName}</div>
        <div>状态：{statusLabels[stockOut.status] ?? stockOut.status}</div>
        <div>下单时间：{dayjs(stockOut.orderedAt).format('YYYY-MM-DD HH:mm')}</div>
        <div>下单人：{stockOut.orderCreatedBy}</div>
        <div>
          审批时间：
          {stockOut.approvedAt ? dayjs(stockOut.approvedAt).format('YYYY-MM-DD HH:mm') : '-'}
        </div>
        <div>审批人：{stockOut.approvedBy || '-'}</div>
        <div>
          出库时间：
          {stockOut.completedAt ? dayjs(stockOut.completedAt).format('YYYY-MM-DD HH:mm') : '-'}
        </div>
        <div>制单人：{stockOut.createdBy || '-'}</div>
        <div className="col-span-2">订单备注：{stockOut.orderRemark || '-'}</div>
        <div className="col-span-2">出库备注：{stockOut.remark || '-'}</div>
      </section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {['序号', '商品编码', '商品名称', '规格', '单位', '数量', '领用单价', '小计'].map(
              (label) => (
                <th key={label} className="border border-black px-2 py-2 text-center font-semibold">
                  {label}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {stockOut.items.map((item, index) => (
            <tr key={item.id} className="break-inside-avoid">
              <td className="border border-black px-2 py-2 text-center">{index + 1}</td>
              <td className="border border-black px-2 py-2">{item.goodsCode}</td>
              <td className="border border-black px-2 py-2">{item.goodsName}</td>
              <td className="border border-black px-2 py-2">{item.goodsSpec || '-'}</td>
              <td className="border border-black px-2 py-2 text-center">{item.goodsUnit}</td>
              <td className="border border-black px-2 py-2 text-right">{item.quantity}</td>
              <td className="border border-black px-2 py-2 text-right">
                ¥{formatAmount(item.unitPrice)}
              </td>
              <td className="border border-black px-2 py-2 text-right">
                ¥{formatAmount(item.lineAmount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="border border-black px-2 py-2 font-semibold" colSpan={5}>
              合计
            </td>
            <td className="border border-black px-2 py-2 text-right font-semibold">
              {totalQuantity}
            </td>
            <td className="border border-black px-2 py-2" />
            <td className="border border-black px-2 py-2 text-right font-semibold">
              ¥{formatAmount(totalAmount)}
            </td>
          </tr>
        </tfoot>
      </table>

      <section className="mt-12 grid grid-cols-3 gap-12 text-sm">
        <div className="border-t border-black pt-2">配货人：</div>
        <div className="border-t border-black pt-2">复核人：</div>
        <div className="border-t border-black pt-2">领用人：</div>
      </section>
    </div>
  )
}
