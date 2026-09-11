'use client'

import { useEffect, useMemo, useState } from 'react'
import { Alert, Empty, Form, Input, InputNumber, Modal, Select, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined } from '@ant-design/icons'
import { createAdminOrder } from '@/actions/order-actions'
import type { OrderGoodsOption } from '@/services/goods.service'
import type { StoreOption } from '@/services/store.service'
import ActionTextButton from '@/components/admin/ActionTextButton'
import { formatGoodsQuantity } from '@/lib/quantity'

interface FormValues {
  storeId: string
  remark?: string
}

interface DraftOrderItem extends OrderGoodsOption {
  key: string
  quantity: number
}

interface AdminOrderCreateModalProps {
  open: boolean
  stores: StoreOption[]
  goods: OrderGoodsOption[]
  onClose: () => void
  onSuccess: () => void
}

export function AdminOrderCreateModal({
  open,
  stores,
  goods,
  onClose,
  onSuccess,
}: AdminOrderCreateModalProps) {
  const [form] = Form.useForm<FormValues>()
  const [items, setItems] = useState<DraftOrderItem[]>([])
  const [goodsPickerValue, setGoodsPickerValue] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      form.resetFields()
      setItems([])
      setGoodsPickerValue(undefined)
    }
  }, [form, open])

  const availableGoods = useMemo(() => {
    const selectedIds = new Set(items.map((item) => item.id))
    return goods.filter((item) => !selectedIds.has(item.id) && item.availableQty > 0)
  }, [goods, items])

  const totalAmount = useMemo(
    () => items.reduce((total, item) => total + item.quantity * item.partnerPrice, 0),
    [items]
  )

  const hasInvalidItems = items.some(
    (item) => item.quantity <= 0 || item.quantity > item.availableQty
  )

  const handleAddGoods = (goodsId: string) => {
    const selectedGoods = goods.find((item) => item.id === goodsId)
    if (!selectedGoods || selectedGoods.availableQty <= 0) return

    setItems((current) => [
      ...current,
      {
        ...selectedGoods,
        key: `${selectedGoods.id}-${Date.now()}`,
        quantity: selectedGoods.measureType === 'INT' ? 1 : 0.1,
      },
    ])
    setGoodsPickerValue(undefined)
  }

  const handleQuantityChange = (key: string, value: number | null) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, quantity: value ?? 0 } : item))
    )
  }

  const handleRemoveItem = (key: string) => {
    setItems((current) => current.filter((item) => item.key !== key))
  }

  const resetFormState = () => {
    form.resetFields()
    setItems([])
    setGoodsPickerValue(undefined)
  }

  const resetAndClose = () => {
    if (submitting) return
    resetFormState()
    onClose()
  }

  const handleSubmit = async (values: FormValues) => {
    if (items.length === 0) {
      message.error('请至少添加一个商品')
      return
    }
    if (hasInvalidItems) {
      message.error('请检查商品数量和可用库存')
      return
    }

    setSubmitting(true)
    try {
      const result = await createAdminOrder({
        storeId: values.storeId,
        items: items.map((item) => ({ goodsId: item.id, quantity: item.quantity })),
        remark: values.remark?.trim() || undefined,
      })

      if (!result.success) {
        message.error(result.message || '创建订单失败')
        return
      }

      message.success(result.message || '订单创建成功')
      resetFormState()
      onSuccess()
    } catch {
      message.error('创建订单失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnsType<DraftOrderItem> = [
    {
      title: '商品',
      key: 'goods',
      width: 250,
      render: (_, item) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{item.name}</div>
          <div className="truncate text-xs text-gray-500">
            {item.code}
            {item.spec ? ` · ${item.spec}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: '可用库存',
      key: 'availableQty',
      width: 120,
      render: (_, item) => (
        <Tag color={item.availableQty > 0 ? 'green' : 'red'}>
          {formatGoodsQuantity(item.availableQty, item.measureType)} {item.unit}
        </Tag>
      ),
    },
    {
      title: '数量',
      key: 'quantity',
      width: 150,
      render: (_, item) => (
        <InputNumber
          aria-label={`设置${item.name}数量`}
          min={item.measureType === 'INT' ? 1 : 0.001}
          max={item.availableQty}
          step={item.measureType === 'INT' ? 1 : 0.1}
          precision={item.measureType === 'INT' ? 0 : 3}
          value={item.quantity}
          onChange={(value) => handleQuantityChange(item.key, value)}
        />
      ),
    },
    {
      title: '单价',
      key: 'partnerPrice',
      width: 100,
      align: 'right',
      render: (_, item) => `¥${item.partnerPrice.toFixed(2)}`,
    },
    {
      title: '小计',
      key: 'subtotal',
      width: 110,
      align: 'right',
      render: (_, item) => (
        <span className="font-medium">¥{(item.quantity * item.partnerPrice).toFixed(2)}</span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 104,
      align: 'center',
      render: (_, item) => (
        <ActionTextButton danger label="移除商品" onClick={() => handleRemoveItem(item.key)} />
      ),
    },
  ]

  return (
    <Modal
      title="新建订单"
      open={open}
      onCancel={resetAndClose}
      onOk={() => form.submit()}
      okText="创建订单"
      cancelText="取消"
      confirmLoading={submitting}
      okButtonProps={{ icon: <PlusOutlined /> }}
      width={960}
      destroyOnHidden
      styles={{ body: { maxHeight: 'calc(100dvh - 180px)', overflowY: 'auto' } }}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Alert
          className="mb-4"
          type="info"
          showIcon
          message="订单将进入待审批流程，库存会在提交时再次校验。"
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item
            label="门店"
            name="storeId"
            rules={[{ required: true, message: '请选择门店' }]}
          >
            <Select
              showSearch
              placeholder="请选择门店"
              optionFilterProp="label"
              options={stores.map((store) => ({
                value: store.id,
                label: `${store.name} (${store.code})`,
              }))}
            />
          </Form.Item>

          <Form.Item label="添加商品">
            <Select
              showSearch
              allowClear
              value={goodsPickerValue}
              placeholder="搜索商品名称或编码"
              optionFilterProp="label"
              notFoundContent="暂无可添加商品"
              options={availableGoods.map((item) => ({
                value: item.id,
                label: `${item.name} · ${item.code} · 库存 ${formatGoodsQuantity(item.availableQty, item.measureType)}${item.unit}`,
              }))}
              onChange={handleAddGoods}
            />
          </Form.Item>
        </div>

        <section className="border border-gray-200">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
            <span className="font-medium">商品明细</span>
            <span className="text-sm text-gray-500">已选 {items.length} 种</span>
          </div>
          {items.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="请先添加商品"
              className="my-8"
            />
          ) : (
            <Table
              size="small"
              columns={columns}
              dataSource={items}
              rowKey="key"
              pagination={false}
              scroll={{ x: 790 }}
            />
          )}
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-x-6 gap-y-2 text-sm">
          <span>
            商品种类 <strong className="ml-1 text-base">{items.length}</strong>
          </span>
          <span>
            订单金额{' '}
            <strong className="ml-1 text-lg text-blue-600">¥{totalAmount.toFixed(2)}</strong>
          </span>
        </div>

        <Form.Item label="备注" name="remark" className="mb-0 mt-4">
          <Input.TextArea rows={3} maxLength={500} showCount placeholder="请输入订单备注（选填）" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
