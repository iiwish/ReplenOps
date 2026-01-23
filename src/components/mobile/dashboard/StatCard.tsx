import { Card } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  title: string
  value: string | number
  subtitle?: string
  color?: string
}

export function StatCard({ icon: Icon, title, value, subtitle, color = 'blue' }: StatCardProps) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
    green: { bg: 'bg-green-50', text: 'text-green-600' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600' },
    red: { bg: 'bg-red-50', text: 'text-red-600' },
  }

  const colors = colorMap[color] ?? colorMap.blue

  return (
    <Card className="flex flex-col items-center p-4">
      <div className={`rounded-full p-3 ${colors.bg}`}>
        <Icon className={`h-6 w-6 ${colors.text}`} />
      </div>
      <div className="mt-3 text-center">
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-gray-500">{title}</div>
        {subtitle && <div className="mt-1 text-xs text-gray-400">{subtitle}</div>}
      </div>
    </Card>
  )
}
