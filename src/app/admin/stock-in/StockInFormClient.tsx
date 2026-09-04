'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Input, InputNumber, Button, Space, Select, Table, Modal, Tooltip, App } from 'antd'
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { createStockIn, updateStockIn, searchGoods } from '@/actions/stock-in-actions'
import type { ColumnsType } from 'antd/es/table'
import type { TableRowSelection } from 'antd/es/table/interface'
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning'

const { TextArea } = Input

interface StockInItem {
  key?: string
  goodsId: string
  goodsCode?: string
  goodsName?: string
  goodsUnit?: string
  measureType?: string
  quantity: number
  price: number
  amount?: number
}

interface StockInFormData {
  warehouseId: string
  items: StockInItem[]
  remark?: string
}

interface StockInFormValues {
  warehouseId: string
  remark?: string
  submitForApproval?: boolean
}

interface StockInFormClientProps {
  mode: 'create' | 'edit'
  initialValues?: StockInFormData & { id: string }
  warehouses: Array<{ id: string; code: string; name: string }>
}

interface GoodsOption {
  id: string
  code: string
  name: string
  unit: string
  measureType: string
  defaultInPrice: number
}

function createFormSnapshot(
  warehouseId: string | undefined,
  remark: string | undefined,
  items: StockInItem[]
): string {
  return JSON.stringify({
    warehouseId: warehouseId ?? '',
    remark: remark ?? '',
    items: items.map((item) => ({
      goodsId: item.goodsId,
      quantity: item.quantity,
      price: item.price,
    })),
  })
}

export default function StockInFormClient({
  mode,
  initialValues,
  warehouses,
}: StockInFormClientProps) {
  const router = useRouter()
  const { message, modal } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [items, setItems] = useState<StockInItem[]>(initialValues?.items || [])
  const [goodsModalVisible, setGoodsModalVisible] = useState(false)
  const [goodsSearchKeyword, setGoodsSearchKeyword] = useState('')
  const [goodsOptions, setGoodsOptions] = useState<GoodsOption[]>([])
  const [goodsLoading, setGoodsLoading] = useState(false)
  const [goodsPage, setGoodsPage] = useState(1)
  const [goodsHasMore, setGoodsHasMore] = useState(true)
  const [selectedGoods, setSelectedGoods] = useState<Record<string, GoodsOption>>({})
  const goodsRequestId = useRef(0)
  const defaultWarehouseId = initialValues?.warehouseId ?? warehouses[0]?.id
  const initialSnapshot = useMemo(
    () => createFormSnapshot(defaultWarehouseId, initialValues?.remark, initialValues?.items ?? []),
    [defaultWarehouseId, initialValues]
  )
  const warehouseId = Form.useWatch('warehouseId', form) ?? defaultWarehouseId
  const remark = Form.useWatch('remark', form)
  const isDirty =
    !hasSubmitted && createFormSnapshot(warehouseId, remark, items) !== initialSnapshot

  useUnsavedChangesWarning(isDirty, '当前入库单尚未保存，确定离开吗？')

  const loadGoods = useCallback(
    async (keyword: string, page: number, append: boolean) => {
      const requestId = ++goodsRequestId.current
      setGoodsLoading(true)
      try {
        const result = await searchGoods(keyword, page, 20)
        if (requestId !== goodsRequestId.current) return

        if (result.success && result.data) {
          const nextGoods = result.data as GoodsOption[]
          setGoodsOptions((current) => (append ? [...current, ...nextGoods] : nextGoods))
          setGoodsPage(page)
          setGoodsHasMore(nextGoods.length === 20)
        } else {
          message.error(result.message || '搜索商品失败')
          if (!append) setGoodsOptions([])
        }
      } catch {
        if (requestId !== goodsRequestId.current) return
        message.error('搜索商品失败')
        if (!append) setGoodsOptions([])
      } finally {
        if (requestId === goodsRequestId.current) setGoodsLoading(false)
      }
    },
    [message]
  )

  useEffect(() => {
    if (!goodsModalVisible) return

    const timer = window.setTimeout(
      () => {
        void loadGoods(goodsSearchKeyword.trim(), 1, false)
      },
      goodsSearchKeyword ? 300 : 0
    )

    return () => window.clearTimeout(timer)
  }, [goodsModalVisible, goodsSearchKeyword, loadGoods])

  const handleGoodsListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 48
    if (isNearBottom && goodsHasMore && !goodsLoading) {
      void loadGoods(goodsSearchKeyword.trim(), goodsPage + 1, true)
    }
  }

  const closeGoodsModal = () => {
    setGoodsModalVisible(false)
    setGoodsSearchKeyword('')
    setGoodsOptions([])
    setGoodsPage(1)
    setGoodsHasMore(true)
    setSelectedGoods({})
  }

  const handleAddSelectedGoods = () => {
    const existingGoodsIds = new Set(items.map((item) => item.goodsId))
    const goodsToAdd = Object.values(selectedGoods).filter(
      (goods) => !existingGoodsIds.has(goods.id)
    )
    if (goodsToAdd.length === 0) return

    const timestamp = Date.now()
    setItems((currentItems) => [
      ...currentItems,
      ...goodsToAdd.map((goods, index) => ({
        key: `${timestamp}_${index}_${goods.id}`,
        goodsId: goods.id,
        goodsCode: goods.code,
        goodsName: goods.name,
        goodsUnit: goods.unit,
        measureType: goods.measureType,
        quantity: 1,
        price: goods.defaultInPrice,
        amount: goods.defaultInPrice,
      })),
    ])
    closeGoodsModal()
    message.success(`已添加 ${goodsToAdd.length} 个商品`)
  }

  // 删除商品
  const handleDeleteItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
  }

  // 更新商品数量
  const handleQuantityChange = (index: number, quantity: number) => {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, quantity, amount: quantity * item.price } : item
      )
    )
  }

  // 更新商品价格
  const handlePriceChange = (index: number, price: number) => {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, price, amount: item.quantity * price } : item
      )
    )
  }

  // 计算总金额
  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.price, 0)
  const hasInvalidItems = items.some((item) => item.quantity <= 0 || item.price < 0)

  // 商品明细表格列定义
  const itemColumns: ColumnsType<StockInItem> = [
    {
      title: '商品编码',
      dataIndex: 'goodsCode',
      key: 'goodsCode',
      width: 120,
    },
    {
      title: '商品名称',
      dataIndex: 'goodsName',
      key: 'goodsName',
      width: 200,
    },
    {
      title: '单位',
      dataIndex: 'goodsUnit',
      key: 'goodsUnit',
      width: 80,
    },
    {
      title: '数量',
      key: 'quantity',
      width: 150,
      render: (_, record, index) => (
        <InputNumber
          min={record.measureType === 'INT' ? 1 : 0.001}
          step={record.measureType === 'INT' ? 1 : 0.1}
          precision={record.measureType === 'INT' ? 0 : 3}
          value={record.quantity}
          onChange={(value) => handleQuantityChange(index, value || 0)}
          aria-label={`${record.goodsName ?? '商品'}入库数量`}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '单价（元）',
      key: 'price',
      width: 150,
      render: (_, record, index) => (
        <InputNumber
          min={0}
          step={0.01}
          precision={2}
          value={record.price}
          onChange={(value) => handlePriceChange(index, value || 0)}
          aria-label={`${record.goodsName ?? '商品'}入库单价`}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '金额（元）',
      key: 'amount',
      width: 120,
      align: 'right',
      render: (_, record) => `¥${(record.quantity * record.price).toFixed(2)}`,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record, index) => (
        <Tooltip title="移除商品">
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            aria-label={`移除${record.goodsName ?? '商品'}`}
            onClick={() => handleDeleteItem(index)}
          />
        </Tooltip>
      ),
    },
  ]

  // 表单提交处理
  const handleSubmit = async (values: StockInFormValues) => {
    if (items.length === 0) {
      message.error('请至少添加一个商品')
      return
    }

    setLoading(true)

    try {
      const submitData = {
        warehouseId: values.warehouseId,
        items: items.map((item) => ({
          goodsId: item.goodsId,
          quantity: item.quantity,
          price: item.price,
        })),
        remark: values.remark,
        submitForApproval: values.submitForApproval || false,
      }

      // 调用对应的 Server Action
      const result =
        mode === 'create'
          ? await createStockIn(submitData)
          : await updateStockIn(initialValues!.id, submitData)

      if (result.success) {
        message.success(result.message)
        setHasSubmitted(true)
        router.push('/admin/stock-in')
        router.refresh()
      } else {
        message.error(result.message || '操作失败')
      }
    } catch {
      message.error('操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    if (!isDirty) {
      router.back()
      return
    }

    modal.confirm({
      title: '放弃未保存的入库单？',
      content: '已填写的仓库、商品明细和备注将不会保留。',
      okText: '放弃并返回',
      cancelText: '继续编辑',
      okButtonProps: { danger: true },
      onOk: () => router.back(),
    })
  }

  const selectedGoodsCount = Object.keys(selectedGoods).length
  const goodsRowSelection: TableRowSelection<GoodsOption> = {
    preserveSelectedRowKeys: true,
    selectedRowKeys: Object.keys(selectedGoods),
    getCheckboxProps: (record) => ({
      disabled: items.some((item) => item.goodsId === record.id),
      name: record.name,
    }),
    onSelect: (record, selected) => {
      setSelectedGoods((current) => {
        const next = { ...current }
        if (selected) next[record.id] = record
        else delete next[record.id]
        return next
      })
    },
    onSelectAll: (selected, _selectedRows, changedRows) => {
      setSelectedGoods((current) => {
        const next = { ...current }
        for (const record of changedRows) {
          if (selected) next[record.id] = record
          else delete next[record.id]
        }
        return next
      })
    },
  }

  return (
    <>
      <Form
        form={form}
        layout="vertical"
        initialValues={{ warehouseId: defaultWarehouseId, remark: initialValues?.remark }}
        onFinish={handleSubmit}
        style={{ maxWidth: 1200 }}
      >
        <div className="max-w-xl">
          <Form.Item
            label="选择仓库"
            name="warehouseId"
            rules={[{ required: true, message: '请选择仓库' }]}
          >
            <Select
              placeholder="请选择仓库"
              disabled={mode === 'edit' && items.length > 0}
              options={warehouses.map((warehouse) => ({
                label: `${warehouse.name} (${warehouse.code})`,
                value: warehouse.id,
              }))}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        </div>

        <section className="mb-6" aria-labelledby="stock-in-items-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
            <div>
              <h3 id="stock-in-items-heading" className="m-0 text-base font-semibold text-gray-900">
                商品明细
              </h3>
              <span className="text-sm text-gray-500">{items.length} 个商品</span>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setSelectedGoods({})
                setGoodsModalVisible(true)
              }}
            >
              添加商品
            </Button>
          </div>
          <Table
            columns={itemColumns}
            dataSource={items}
            rowKey={(record) => record.key || record.goodsId}
            pagination={false}
            locale={{ emptyText: '暂无商品' }}
            scroll={{ x: 900 }}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5} align="right">
                  <strong>总金额</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <strong className="text-base text-red-600">¥{totalAmount.toFixed(2)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} />
              </Table.Summary.Row>
            )}
          />
        </section>

        <div className="max-w-2xl">
          <Form.Item label="备注" name="remark">
            <TextArea placeholder="请输入备注信息" rows={4} maxLength={500} showCount />
          </Form.Item>
        </div>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white py-4">
          <span className="text-sm text-gray-600">
            共 {items.length} 个商品，合计{' '}
            <strong className="text-base text-red-600">¥{totalAmount.toFixed(2)}</strong>
          </span>
          <Space>
            <Button onClick={handleCancel} disabled={loading}>
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={items.length === 0 || hasInvalidItems}
            >
              {mode === 'create' ? '创建入库单' : '更新入库单'}
            </Button>
          </Space>
        </div>
      </Form>

      {/* 商品选择弹窗 */}
      <Modal
        title="选择商品"
        open={goodsModalVisible}
        onCancel={closeGoodsModal}
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500">已选 {selectedGoodsCount} 项</span>
            <Space>
              <Button onClick={closeGoodsModal}>取消</Button>
              <Button
                type="primary"
                disabled={selectedGoodsCount === 0}
                onClick={handleAddSelectedGoods}
              >
                添加 {selectedGoodsCount} 项
              </Button>
            </Space>
          </div>
        }
        width={800}
        maskClosable={false}
      >
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          <Input
            placeholder="搜索商品名称或编码"
            prefix={<SearchOutlined />}
            value={goodsSearchKeyword}
            onChange={(e) => setGoodsSearchKeyword(e.target.value)}
            allowClear
            autoFocus
          />

          <div style={{ maxHeight: 400, overflowY: 'auto' }} onScroll={handleGoodsListScroll}>
            {goodsOptions.length > 0 ? (
              <Table
                columns={[
                  {
                    title: '商品编码',
                    dataIndex: 'code',
                    key: 'code',
                    width: 120,
                  },
                  {
                    title: '商品名称',
                    dataIndex: 'name',
                    key: 'name',
                    width: 200,
                  },
                  {
                    title: '单位',
                    dataIndex: 'unit',
                    key: 'unit',
                    width: 80,
                  },
                  {
                    title: '默认入库价',
                    dataIndex: 'defaultInPrice',
                    key: 'defaultInPrice',
                    width: 120,
                    align: 'right',
                    render: (price: number) => `¥${price.toFixed(2)}`,
                  },
                ]}
                dataSource={goodsOptions}
                rowKey="id"
                rowSelection={goodsRowSelection}
                pagination={false}
                loading={goodsLoading && goodsOptions.length === 0}
                size="small"
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                {goodsLoading ? '正在加载商品...' : '未找到相关商品，请尝试其他关键词'}
              </div>
            )}
            {goodsOptions.length > 0 && (
              <div style={{ padding: 12, textAlign: 'center', color: '#8c8c8c' }}>
                {goodsLoading
                  ? '正在加载更多...'
                  : goodsHasMore
                    ? `已显示 ${goodsOptions.length} 个商品`
                    : '已显示全部商品'}
              </div>
            )}
          </div>
        </Space>
      </Modal>
    </>
  )
}
