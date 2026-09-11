import type { ReactNode } from 'react'

export default function TableActions({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-1">{children}</div>
  )
}
