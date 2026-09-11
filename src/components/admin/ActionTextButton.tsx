'use client'

import { Button } from 'antd'
import type { ButtonProps } from 'antd'

interface ActionTextButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'type' | 'size'> {
  label: string
}

export default function ActionTextButton({
  label,
  style,
  'aria-label': ariaLabel,
  ...buttonProps
}: ActionTextButtonProps) {
  return (
    <Button
      {...buttonProps}
      type="link"
      size="small"
      aria-label={ariaLabel ?? label}
      style={{ paddingInline: 0, height: 24, maxWidth: '100%', ...style }}
    >
      {label}
    </Button>
  )
}
