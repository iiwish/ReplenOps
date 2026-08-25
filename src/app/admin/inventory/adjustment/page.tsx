import { redirect } from 'next/navigation'

export default function InventoryAdjustmentPage() {
  redirect('/admin/inventory/logs?adjustment=1')
}
