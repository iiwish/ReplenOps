'use client'

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import dayjs from 'dayjs'
import type { StockOutDetail } from '@/services/stock-out.service'
import { sortStockOutPrintItems } from '@/lib/stock-out-print-order'
import { paginateStockOutPrintRows } from '@/lib/stock-out-print-pagination'
import { PrintButton } from './PrintButton'

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

interface StockOutPrintContentProps {
  stockOut: StockOutDetail
}

export default function StockOutPrintContent({ stockOut }: StockOutPrintContentProps) {
  const printItems = sortStockOutPrintItems(stockOut.items)
  const totalQuantity = stockOut.items.reduce((sum, item) => sum + item.quantity, 0)
  const totalAmount = stockOut.items.reduce((sum, item) => sum + item.lineAmount, 0)
  const [chunks, setChunks] = useState<number[][] | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const headingRef = useRef<HTMLElement>(null)
  const infoRef = useRef<HTMLElement>(null)
  const headRef = useRef<HTMLTableSectionElement>(null)
  const totalRef = useRef<HTMLTableRowElement>(null)
  const signaturesRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let cancelled = false
    const outerHeight = (element: HTMLElement | null) => {
      if (!element) return 0
      const style = getComputedStyle(element)
      return (
        element.getBoundingClientRect().height +
        (Number.parseFloat(style.marginTop) || 0) +
        (Number.parseFloat(style.marginBottom) || 0)
      )
    }
    const measure = () => {
      if (cancelled) return
      const table = tableRef.current
      if (!table) return
      const rowElements = Array.from(table.querySelectorAll('tbody tr[data-print-row]'))
      if (rowElements.length !== printItems.length) return
      const next = paginateStockOutPrintRows(
        printItems.length,
        {
          heading: outerHeight(headingRef.current),
          info: outerHeight(infoRef.current),
          head: headRef.current?.getBoundingClientRect().height ?? 0,
          rows: rowElements.map((element) => element.getBoundingClientRect().height),
          total: totalRef.current?.getBoundingClientRect().height ?? 0,
          signatures: outerHeight(signaturesRef.current),
        },
        {
          marginBoxesSupported: document.documentElement.dataset.printMarginBoxes !== 'false',
        }
      )
      const signature = JSON.stringify(next)
      setChunks((previous) =>
        previous && JSON.stringify(previous) === signature ? previous : next
      )
    }
    measure()
    const fontsReady = document.fonts?.ready
    if (fontsReady) {
      void fontsReady.then(() => measure()).catch(() => {})
    }
    window.addEventListener('resize', measure)
    // Print styles change the available width; commit pagination before the browser snapshots it.
    const beforePrint = () => flushSync(measure)
    const printMedia = window.matchMedia('print')
    window.addEventListener('beforeprint', beforePrint)
    printMedia.addEventListener('change', measure)
    return () => {
      cancelled = true
      window.removeEventListener('resize', measure)
      window.removeEventListener('beforeprint', beforePrint)
      printMedia.removeEventListener('change', measure)
    }
  }, [stockOut, printItems.length])
  const visibleChunks = chunks ?? [printItems.map((_, index) => index)]
  // Encode every character as a CSS escape so document codes cannot inject CSS or HTML.
  const printCode = Array.from(
    `单号：${stockOut.code}`,
    (char) => `\\${char.codePointAt(0)!.toString(16)} `
  ).join('')

  return (
    <div className="stock-out-print-page mx-auto w-[186mm] max-w-full bg-white text-black">
      <style>{`@media print { @page stock-out { @top-right { content: "${printCode}"; } } }`}</style>
      <div className="stock-out-print-actions mb-3 flex justify-end">
        <PrintButton />
      </div>

      <header
        ref={headingRef}
        className="stock-out-print-heading mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-black pb-2"
      >
        <h1 className="text-xl font-bold">出库单</h1>
        <p className="break-all text-xs">单号：{stockOut.code}</p>
      </header>

      <section
        ref={infoRef}
        className="stock-out-print-info mb-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs leading-4 [overflow-wrap:anywhere]"
      >
        <div>订单号：{stockOut.orderCode}</div>
        <div>门店：{stockOut.storeName}</div>
        <div>
          出库仓库：{stockOut.warehouseName} · {statusLabels[stockOut.status] ?? stockOut.status}
        </div>
        <div>制单人：{stockOut.createdByName}</div>
        <div>
          下单：{dayjs(stockOut.orderedAt).format('YYYY-MM-DD HH:mm')} ·{' '}
          {stockOut.orderCreatedByName}
        </div>
        <div>
          审批：
          {stockOut.approvedAt ? dayjs(stockOut.approvedAt).format('YYYY-MM-DD HH:mm') : '-'}
          {' · '}
          {stockOut.approvedByName || '-'}
        </div>
        <div>
          出库时间：
          {stockOut.completedAt ? dayjs(stockOut.completedAt).format('YYYY-MM-DD HH:mm') : '-'}
        </div>
        {stockOut.orderRemark && <div>订单备注：{stockOut.orderRemark}</div>}
        {stockOut.remark && <div>出库备注：{stockOut.remark}</div>}
      </section>

      <table
        ref={tableRef}
        className="stock-out-print-table w-full border-collapse text-xs leading-[15px] [&_td]:px-1 [&_td]:py-1 [&_th]:px-1 [&_th]:py-1"
      >
        <thead ref={headRef}>
          <tr>
            {[
              '序号',
              '分类',
              '商品编码',
              '商品名称',
              '规格',
              '单位',
              '数量',
              '领用单价',
              '小计',
            ].map((label) => (
              <th key={label} className="border border-black px-2 py-2 text-center font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        {visibleChunks.map((indexes, pageIndex) => (
          <tbody
            key={pageIndex}
            className={
              pageIndex < visibleChunks.length - 1 ? 'stock-out-print-page-break' : undefined
            }
          >
            {indexes.map((itemIndex) => {
              const item = printItems[itemIndex]
              if (!item) return null
              return (
                <tr key={item.id} data-print-row className="break-inside-avoid">
                  <td className="border border-black px-2 py-2 text-center">{itemIndex + 1}</td>
                  <td className="break-words border border-black px-2 py-2">
                    {item.categoryName.trim() || '未分类'}
                  </td>
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
              )
            })}
            {pageIndex === visibleChunks.length - 1 && (
              <tr ref={totalRef} className="stock-out-print-total">
                <td className="border border-black px-2 py-2 font-semibold" colSpan={6}>
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
            )}
          </tbody>
        ))}
      </table>

      <section
        ref={signaturesRef}
        className="stock-out-print-signatures mt-6 grid grid-cols-3 gap-6 text-xs"
      >
        <div>配货人：</div>
        <div>复核人：</div>
        <div>领用人：</div>
      </section>
    </div>
  )
}
