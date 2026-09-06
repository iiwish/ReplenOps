'use client'

import { Button, Tooltip } from 'antd'
import type { ButtonProps } from 'antd'

interface ActionIconButtonProps extends Omit<ButtonProps, 'children'> {
  tooltip: string
}

export default function ActionIconButton({
  tooltip,
  'aria-label': ariaLabel,
  ...buttonProps
}: ActionIconButtonProps) {
  return (
    <Tooltip title={tooltip}>
      <Button {...buttonProps} aria-label={ariaLabel ?? tooltip} />
    </Tooltip>
  )
}
