import { redirect } from 'next/navigation'

export default async function OrderApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/admin/orders?status=PENDING&approval=${encodeURIComponent(id)}`)
}
