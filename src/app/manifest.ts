import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ReplenOps',
    short_name: 'ERP',
    description: '门店订货与库存协同平台',
    start_url: '/mobile',
    scope: '/mobile',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1677ff',
    orientation: 'portrait',
    icons: [],
  }
}
