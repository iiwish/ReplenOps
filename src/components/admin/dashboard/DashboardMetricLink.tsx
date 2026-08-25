import { ArrowRightOutlined } from '@ant-design/icons'
import { Card, Statistic } from 'antd'
import type { Route } from 'next'
import Link from 'next/link'

interface DashboardMetricLinkProps {
  href: Route
  title: string
  value: number
  description?: string
  compact?: boolean
}

export function DashboardMetricLink({
  href,
  title,
  value,
  description,
  compact = false,
}: DashboardMetricLinkProps) {
  return (
    <Link
      href={href}
      aria-label={`查看${title}`}
      className="group block h-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      <Card
        title={compact ? undefined : title}
        variant="borderless"
        className="h-full transition-shadow duration-200 group-hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <Statistic title={compact ? title : undefined} value={value} />
          <ArrowRightOutlined
            className="mt-1 text-xs text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-blue-500"
            aria-hidden="true"
          />
        </div>
        {description ? <p className="mt-4 text-gray-600">{description}</p> : null}
      </Card>
    </Link>
  )
}
