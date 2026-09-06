import { Modal } from 'antd'

interface ConfirmStockOutOptions {
  stockOutCode: string
  onConfirm: () => Promise<void>
}

export function confirmStockOut({ stockOutCode, onConfirm }: ConfirmStockOutOptions) {
  return Modal.confirm({
    title: '确认出库',
    content: `确定要确认出库单"${stockOutCode}"吗？此操作将扣减库存并记录出库成本。`,
    okText: '确认',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: onConfirm,
  })
}
