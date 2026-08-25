import { redirect } from 'next/navigation'

export default function OrderApprovalPage() {
  redirect('/admin/orders?status=PENDING')
}
