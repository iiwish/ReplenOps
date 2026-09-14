'use client'

import { Button } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import { useEffect } from 'react'

export function PrintButton() {
  useEffect(() => {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync('@page { @top-left { content: "test"; } }')
    const rule = sheet.cssRules[0]
    const supported = rule instanceof CSSPageRule && rule.cssRules.length > 0
    document.documentElement.dataset.printMarginBoxes = String(supported)
  }, [])

  return (
    <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
      打印出库单
    </Button>
  )
}
