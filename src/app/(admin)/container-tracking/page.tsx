import { TrackingSummary } from '@/components/admin/containers/TrackingSummary'
import { TrackingTable } from '@/components/admin/containers/TrackingTable'

export default function ContainerTrackingPage() {
  return (
    <div style={{ padding: '24px' }}>
      <h1>包装物台账查询</h1>
      <TrackingSummary />
      <TrackingTable />
    </div>
  )
}
