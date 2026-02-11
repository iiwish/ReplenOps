'use client'

import { AntdRegistry } from '@ant-design/nextjs-registry'
import React from 'react'

/**
 * AntdRegistry wrapper for root layout
 * This must be in root layout to ensure SSR styles are correctly extracted
 */
export function AntdRegistryProvider({ children }: { children: React.ReactNode }) {
  return <AntdRegistry hashPriority="low">{children}</AntdRegistry>
}

// Re-export AntdRegistry for direct use
export { AntdRegistry }
