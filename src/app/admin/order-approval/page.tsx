import { Suspense } from 'react'
import { ApprovalListClient } from './ApprovalListClient'

export default function OrderApprovalPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">待审批订单</h1>
      <Suspense fallback={<div>加载中...</div>}>
        <ApprovalListClient />
      </Suspense>
    </div>
  )
}
