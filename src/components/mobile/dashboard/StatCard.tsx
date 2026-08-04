import { Card } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  title: string
  value: string | number
  subtitle?: string
  color?: string
  compact?: boolean
}

export function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  color = 'blue',
  compact = false,
}: StatCardProps) {
  const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100' },
    green: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', ring: 'ring-orange-100' },
    red: { bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-100' },
  }
  const defaultColors = { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100' }

  const colors = colorMap[color] || defaultColors

  return (
    <Card
      className={`flex flex-col justify-between rounded-lg border-gray-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
        compact ? 'min-h-[78px] p-2.5' : 'min-h-[108px] p-3.5'
      }`}
    >
      <div className={`flex min-w-0 items-center ${compact ? 'gap-2' : 'gap-2.5'}`}>
        <div
          className={`flex shrink-0 items-center justify-center rounded-lg ring-1 ${colors.bg} ${colors.ring} ${
            compact ? 'h-7 w-7' : 'h-9 w-9'
          }`}
        >
          <Icon
            className={`${compact ? 'h-4 w-4' : 'h-[18px] w-[18px]'} ${colors.text}`}
            strokeWidth={2}
          />
        </div>
        <div
          className={`min-w-0 font-medium text-gray-600 ${compact ? 'text-xs leading-4' : 'text-sm leading-5'}`}
        >
          {title}
        </div>
      </div>
      <div className={`flex items-end justify-between gap-2 ${compact ? 'mt-2' : 'mt-3'}`}>
        <div
          className={`font-semibold leading-none text-gray-950 ${compact ? 'text-xl' : 'text-2xl'}`}
        >
          {value}
        </div>
        {subtitle && <div className="truncate text-right text-xs text-gray-400">{subtitle}</div>}
      </div>
    </Card>
  )
}
