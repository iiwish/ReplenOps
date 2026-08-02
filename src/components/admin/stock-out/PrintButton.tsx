'use client'

import { Button } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'

export function PrintButton() {
  return (
    <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
      打印出库单
    </Button>
  )
}
