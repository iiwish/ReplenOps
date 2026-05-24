'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Form,
  Input,
  InputNumber,
  Button,
  Card,
  message,
  Space,
  Select,
  Table,
  Modal,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { createStockIn, updateStockIn, searchGoods } from '@/actions/stock-in-actions'
import type { ColumnsType } from 'antd/es/table'

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

export default function StockInFormClient({
  mode,
  initialValues,
  warehouses,
}: StockInFormClientProps) {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [shouldNavigateTo, setShouldNavigateTo] = useState<string | null>(null)
  const [items, setItems] = useState<StockInItem[]>(initialValues?.items || [])
  const [goodsModalVisible, setGoodsModalVisible] = useState(false)
  const [goodsSearchKeyword, setGoodsSearchKeyword] = useState('')
  const [goodsOptions, setGoodsOptions] = useState<GoodsOption[]>([])
  const [goodsLoading, setGoodsLoading] = useState(false)

  // 搜索商品
  const handleSearchGoods = async (keyword: string) => {
    if (!keyword || keyword.trim() === '') {
      setGoodsOptions([])
      return
    }

    setGoodsLoading(true)
    try {
      const result = await searchGoods(keyword)
      if (result.success && result.data) {
        setGoodsOptions(result.data as GoodsOption[])
      } else {
        message.error(result.message || '搜索商品失败')
        setGoodsOptions([])
      }
    } catch {
      message.error('搜索商品失败')
      setGoodsOptions([])
    } finally {
      setGoodsLoading(false)
    }
  }

  // 添加商品
  const handleAddGoods = (goods: GoodsOption) => {
    // 检查是否已添加
    if (items.some((item) => item.goodsId === goods.id)) {
      message.warning('该商品已添加')
      return
    }

    const newItem: StockInItem = {
      key: `${Date.now()}_${Math.random()}`,
      goodsId: goods.id,
      goodsCode: goods.code,
      goodsName: goods.name,
      goodsUnit: goods.unit,
      measureType: goods.measureType,
      quantity: 1,
      price: goods.defaultInPrice,
      amount: goods.defaultInPrice,
    }

    setItems([...items, newItem])
    setGoodsModalVisible(false)
    setGoodsSearchKeyword('')
    setGoodsOptions([])
    message.success('商品已添加')
  }

  // 删除商品
  const handleDeleteItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
  }

  // 更新商品数量
  const handleQuantityChange = (index: number, quantity: number) => {
    const newItems = [...items]
    if (newItems[index]) {
      newItems[index].quantity = quantity
      newItems[index].amount = quantity * newItems[index].price
      setItems(newItems)
    }
  }

  // 更新商品价格
  const handlePriceChange = (index: number, price: number) => {
    const newItems = [...items]
    if (newItems[index]) {
      newItems[index].price = price
      newItems[index].amount = newItems[index].quantity * price
      setItems(newItems)
    }
  }

  // 计算总金额
  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0)

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
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '金额（元）',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right',
      render: (amount: number) => `¥${amount.toFixed(2)}`,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, __, index) => (
        <Button
          type="link"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteItem(index)}
        >
          删除
        </Button>
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
        setShouldNavigateTo('/admin/stock-in')
      } else {
        message.error(result.message || '操作失败')
      }
    } catch {
      message.error('操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (shouldNavigateTo) {
      window.location.href = shouldNavigateTo
    }
  }, [shouldNavigateTo])

  return (
    <>
      <Card variant="borderless">
        <Form
          form={form}
          layout="vertical"
          initialValues={initialValues}
          onFinish={handleSubmit}
          style={{ maxWidth: 1200 }}
        >
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

          <Card
            title="商品明细"
            size="small"
            style={{ marginBottom: 24 }}
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setGoodsModalVisible(true)}
              >
                添加商品
              </Button>
            }
          >
            <Table
              columns={itemColumns}
              dataSource={items}
              rowKey={(record) => record.key || record.goodsId}
              pagination={false}
              locale={{ emptyText: '暂无商品，请点击"添加商品"按钮' }}
              scroll={{ x: 900 }}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={5} align="right">
                    <strong>总金额：</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <strong style={{ fontSize: 16, color: '#ff4d4f' }}>
                      ¥{totalAmount.toFixed(2)}
                    </strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} />
                </Table.Summary.Row>
              )}
            />
          </Card>

          <Form.Item label="备注" name="remark">
            <TextArea
              placeholder="请输入备注信息"
              rows={4}
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                disabled={items.length === 0}
              >
                {mode === 'create' ? '创建入库单' : '更新入库单'}
              </Button>
              <Button onClick={() => router.back()}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 商品选择弹窗 */}
      <Modal
        title="选择商品"
        open={goodsModalVisible}
        onCancel={() => {
          setGoodsModalVisible(false)
          setGoodsSearchKeyword('')
          setGoodsOptions([])
        }}
        footer={null}
        width={800}
      >
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          <Input
            placeholder="搜索商品名称或编码"
            prefix={<SearchOutlined />}
            value={goodsSearchKeyword}
            onChange={(e) => setGoodsSearchKeyword(e.target.value)}
            onPressEnter={() => handleSearchGoods(goodsSearchKeyword)}
            allowClear
          />
          <Button
            type="primary"
            onClick={() => handleSearchGoods(goodsSearchKeyword)}
            loading={goodsLoading}
          >
            搜索
          </Button>

          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
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
                  {
                    title: '操作',
                    key: 'action',
                    width: 100,
                    render: (_, record) => (
                      <Button
                        type="link"
                        onClick={() => handleAddGoods(record)}
                      >
                        添加
                      </Button>
                    ),
                  },
                ]}
                dataSource={goodsOptions}
                rowKey="id"
                pagination={false}
                size="small"
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                {goodsSearchKeyword
                  ? '未找到相关商品，请尝试其他关键词'
                  : '请输入关键词搜索商品'}
              </div>
            )}
          </div>
        </Space>
      </Modal>
    </>
  )
}
