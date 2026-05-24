import { Suspense } from 'react'
import { ApprovalDetailClient } from './ApprovalDetailClient'

export default function OrderApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">订单审批</h1>
      <Suspense fallback={<div>加载中...</div>}>
        <ApprovalDetailClientWrapper params={params} />
      </Suspense>
    </div>
  )
}

async function ApprovalDetailClientWrapper({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ApprovalDetailClient orderId={id} />
}
