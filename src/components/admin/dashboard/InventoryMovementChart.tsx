'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DashboardInventoryChange } from '@/services/dashboard.service'

interface InventoryMovementChartProps {
  data: DashboardInventoryChange[]
}

const formatQuantity = (value: number) =>
  value.toLocaleString('zh-CN', { maximumFractionDigits: 3 })

export function InventoryMovementChart({ data }: InventoryMovementChartProps) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#8c8c8c', fontSize: 12 }}
            tickFormatter={(value: string) => value.slice(5)}
            minTickGap={24}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#8c8c8c', fontSize: 12 }}
            tickFormatter={formatQuantity}
            width={52}
          />
          <Tooltip
            cursor={{ fill: '#f5f5f5' }}
            labelFormatter={(label) => `日期：${String(label)}`}
            formatter={(value, name) => [formatQuantity(Number(value ?? 0)), String(name)]}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
          <Bar dataKey="inbound" name="入库" fill="#1677ff" radius={[3, 3, 0, 0]} />
          <Bar dataKey="outbound" name="出库" fill="#ff7875" radius={[3, 3, 0, 0]} />
          <Bar dataKey="returned" name="退回" fill="#52c41a" radius={[3, 3, 0, 0]} />
          <Bar dataKey="adjustment" name="调整" fill="#faad14" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
