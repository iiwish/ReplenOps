'use client'

import { useState, useEffect } from 'react'
import {
  Form,
  Select,
  InputNumber,
  Input,
  Button,
  Space,
  message,
  Spin,
  Statistic,
  Row,
  Col,
  Alert,
  Divider,
  Modal,
} from 'antd'
import { SaveOutlined, CloseOutlined } from '@ant-design/icons'
import { adjustStock, getInventoryInfo } from '@/actions/inventory-actions'
import { searchGoods } from '@/actions/stock-in-actions'

interface Props {
  open: boolean
  warehouses: Array<{ id: string; name: string }>
  onCancel: () => void
  onCompleted: () => void | Promise<void>
}

interface GoodsOption {
  id: string
  code: string
  name: string
  unit: string
}

interface InventoryInfo {
  quantity: number
  availableQuantity: number
  lockedQuantity: number
  goodsUnit: string
}

interface AdjustmentValues {
  warehouseId: string
  goodsId: string
  newQuantity: number
  reason: string
}

export default function InventoryAdjustmentModal({
  open,
  warehouses,
  onCancel,
  onCompleted,
}: Props) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [searchingGoods, setSearchingGoods] = useState(false)

  // 商品选项
  const [goodsOptions, setGoodsOptions] = useState<GoodsOption[]>([])

  // 当前库存信息
  const [currentInventory, setCurrentInventory] = useState<InventoryInfo | null>(null)

  // 计算变动数量
  const [changeQty, setChangeQty] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return

    form.resetFields()
    setCurrentInventory(null)
    setChangeQty(null)
    setGoodsOptions([])
  }, [form, open])

  // 搜索商品
  const handleSearchGoods = async (keyword: string) => {
    if (!keyword || keyword.length < 2) {
      return
    }

    setSearchingGoods(true)
    try {
      const result = await searchGoods(keyword)
      if (result.success && result.data) {
        setGoodsOptions(result.data as GoodsOption[])
      }
    } catch {
      message.error('搜索商品失败')
    } finally {
      setSearchingGoods(false)
    }
  }

  // 选择商品后加载库存信息
  const handleGoodsChange = async (goodsId: string) => {
    const warehouseId = form.getFieldValue('warehouseId')
    if (!warehouseId) {
      message.warning('请先选择仓库')
      form.setFieldValue('goodsId', undefined)
      return
    }

    // 清空当前信息
    setCurrentInventory(null)
    setChangeQty(null)
    form.setFieldValue('newQuantity', undefined)

    setLoadingInventory(true)
    try {
      const result = await getInventoryInfo(warehouseId, goodsId)
      if (result.success && result.data) {
        const inventory = result.data as InventoryInfo
        setCurrentInventory({
          quantity: inventory.quantity,
          availableQuantity: inventory.availableQuantity,
          lockedQuantity: inventory.lockedQuantity,
          goodsUnit: inventory.goodsUnit,
        })
      } else {
        message.error(result.message || '未找到库存记录')
        form.setFieldValue('goodsId', undefined)
      }
    } catch {
      message.error('加载库存信息失败')
      form.setFieldValue('goodsId', undefined)
    } finally {
      setLoadingInventory(false)
    }
  }

  // 输入新数量后计算变动
  const handleNewQuantityChange = (value: number | null) => {
    if (value !== null && currentInventory) {
      const change = value - currentInventory.quantity
      setChangeQty(change)
    } else {
      setChangeQty(null)
    }
  }

  const submitAdjustment = async (values: AdjustmentValues) => {
    setLoading(true)
    try {
      const result = await adjustStock({ ...values, reason: values.reason.trim() })

      if (result.success) {
        message.success(result.message)
        await onCompleted()
      } else {
        if (result.errors) {
          // 显示字段级错误
          const fieldErrors = Object.entries(result.errors).map(([field, errors]) => ({
            name: field,
            errors: errors,
          }))
          form.setFields(fieldErrors)
        } else {
          message.error(result.message || '库存调整失败')
        }
      }
    } catch {
      message.error('库存调整失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (values: AdjustmentValues) => {
    if (!currentInventory) return

    if (values.newQuantity === currentInventory.quantity) {
      form.setFields([{ name: 'newQuantity', errors: ['调整后数量与当前库存相同'] }])
      return
    }
    if (values.newQuantity < currentInventory.lockedQuantity) {
      form.setFields([
        {
          name: 'newQuantity',
          errors: [`调整后数量不能低于锁定库存 ${currentInventory.lockedQuantity}`],
        },
      ])
      return
    }

    const warehouseName =
      warehouses.find((warehouse) => warehouse.id === values.warehouseId)?.name ?? '所选仓库'
    const goodsName =
      goodsOptions.find((goods) => goods.id === values.goodsId)?.name ?? '所选商品'
    const adjustment = values.newQuantity - currentInventory.quantity
    const unit = currentInventory.goodsUnit

    Modal.confirm({
      title: '确认提交库存调整？',
      content: (
        <div className="space-y-2 text-sm">
          <p className="m-0 text-gray-600">
            {warehouseName} · {goodsName}
          </p>
          <p className="m-0">
            库存将从 <strong>{currentInventory.quantity}</strong> 调整为{' '}
            <strong>{values.newQuantity}</strong> {unit}，变动{' '}
            <strong className={adjustment < 0 ? 'text-red-600' : 'text-green-700'}>
              {adjustment > 0 ? '+' : ''}
              {adjustment} {unit}
            </strong>
          </p>
          <p className="m-0 text-gray-600">原因：{values.reason.trim()}</p>
        </div>
      ),
      okText: '确认调整',
      cancelText: '返回核对',
      okButtonProps: { danger: adjustment < 0 },
      onOk: () => submitAdjustment(values),
    })
  }

  return (
    <Modal
      title="调整库存"
      open={open}
      width={880}
      style={{ top: 24, maxWidth: 'calc(100vw - 32px)' }}
      styles={{ body: { maxHeight: 'calc(100vh - 150px)', overflowY: 'auto' } }}
      footer={null}
      maskClosable={false}
      keyboard={!loading}
      closable={!loading}
      destroyOnHidden
      onCancel={onCancel}
    >
      <Alert
        title="请核对实盘数量后再提交"
        description="手动调整库存会直接修改库存数量，请谨慎操作。调整时会同步更新可用库存，但不影响锁定库存。"
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{ warehouseId: warehouses[0]?.id }}
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item
              label="仓库"
              name="warehouseId"
              rules={[{ required: true, message: '请选择仓库' }]}
            >
              <Select
                placeholder="选择仓库"
                options={warehouses.map((w) => ({
                  label: w.name,
                  value: w.id,
                }))}
                onChange={() => {
                  // 切换仓库时清空商品和库存信息
                  form.setFieldValue('goodsId', undefined)
                  setCurrentInventory(null)
                  setChangeQty(null)
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label="商品"
              name="goodsId"
              rules={[{ required: true, message: '请选择商品' }]}
            >
              <Select
                showSearch
                placeholder="搜索商品（输入名称或编码）"
                filterOption={false}
                onSearch={handleSearchGoods}
                onChange={handleGoodsChange}
                loading={searchingGoods}
                notFoundContent={searchingGoods ? <Spin size="small" /> : '请输入关键词搜索'}
                options={goodsOptions.map((g) => ({
                  label: `${g.name} (${g.code})`,
                  value: g.id,
                }))}
              />
            </Form.Item>
          </Col>
        </Row>

        {loadingInventory && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Spin tip="加载库存信息中..." />
          </div>
        )}

        {currentInventory && !loadingInventory && (
          <>
            <Divider>当前库存信息</Divider>
            <Row gutter={24} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={8}>
                <Statistic
                  title="总库存"
                  value={currentInventory.quantity}
                  suffix={currentInventory.goodsUnit}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title="可用库存"
                  value={currentInventory.availableQuantity}
                  suffix={currentInventory.goodsUnit}
                  styles={{ content: { color: '#3f8600' } }}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title="锁定库存"
                  value={currentInventory.lockedQuantity}
                  suffix={currentInventory.goodsUnit}
                  styles={{ content: { color: '#cf1322' } }}
                />
              </Col>
            </Row>

            <Divider>调整信息</Divider>
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="调整后数量"
                  name="newQuantity"
                  rules={[
                    { required: true, message: '请输入调整后的数量' },
                    { type: 'number', min: 0, message: '数量不能为负数' },
                  ]}
                >
                  <InputNumber
                    placeholder="输入调整后的数量"
                    style={{ width: '100%' }}
                    step={0.001}
                    precision={3}
                    onChange={handleNewQuantityChange}
                    aria-label="调整后库存数量"
                    addonAfter={currentInventory.goodsUnit}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                {changeQty !== null && (
                  <div style={{ marginTop: 30 }}>
                    <Statistic
                      title="变动数量"
                      value={changeQty}
                      suffix={currentInventory.goodsUnit}
                      prefix={changeQty > 0 ? '+' : ''}
                      styles={{
                        content: {
                          color: changeQty > 0 ? '#52c41a' : changeQty < 0 ? '#ff4d4f' : '#000',
                        },
                      }}
                    />
                    {changeQty === 0 && (
                      <div className="mt-1 text-sm text-orange-600">库存数量未发生变化</div>
                    )}
                  </div>
                )}
              </Col>
            </Row>

            <Form.Item
              label="调整原因"
              name="reason"
              rules={[
                { required: true, message: '请填写调整原因' },
                { min: 2, message: '调整原因至少2个字符' },
              ]}
            >
              <Input.TextArea
                placeholder="请详细说明库存调整的原因（必填）"
                rows={4}
                maxLength={500}
                showCount
              />
            </Form.Item>
          </>
        )}

        <Form.Item style={{ marginTop: 24 }}>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={loading}
              disabled={!currentInventory || loadingInventory || changeQty === 0}
            >
              提交调整
            </Button>
            <Button icon={<CloseOutlined />} onClick={onCancel} disabled={loading}>
              取消
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
