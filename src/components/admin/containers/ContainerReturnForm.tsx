'use client'

import React, { useState, useTransition } from 'react'
import {
  Form,
  Input,
  Select,
  Button,
  Card,
  Row,
  Col,
  InputNumber,
  message,
  Space,
  Divider,
} from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { batchReturnContainers, getReturnableContainers } from '@/actions/container-return-actions'

interface ReturnItem {
  containerId: string
  containerName: string
  currentBorrowed: number
  deposit: number
  quantity: number
}

interface Container {
  trackingId: string
  containerId: string
  containerName: string
  currentBorrowed: number
  deposit: number
}

interface ContainerReturnFormProps {
  storeId?: string
  onSuccess?: () => void
}

interface StoreListItem {
  id: string
  name: string
}

export function ContainerReturnForm({ onSuccess }: ContainerReturnFormProps) {
  const [form] = Form.useForm()
  const [isPending, startTransition] = useTransition()
  const [stores, setStores] = useState<StoreListItem[]>([])
  const [containers, setContainers] = useState<Container[]>([])
  const [items, setItems] = useState<ReturnItem[]>([])

  const loadStores = async () => {
    try {
      const response = await fetch('/api/stores/user', {
        cache: 'no-store',
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          setStores(result.data)
        }
      } else {
        message.error('加载门店失败')
      }
    } catch (error) {
      console.error('加载门店失败:', error)
      message.error('加载门店失败')
    }
  }

  const loadReturnableContainers = async (storeId: string) => {
    try {
      const result = await getReturnableContainers({ storeId })
      if (result.success && Array.isArray(result.data)) {
        setContainers(result.data as Container[])
      } else {
        message.error(result.message || '加载包装物失败')
      }
    } catch (error) {
      console.error('加载包装物失败:', error)
      message.error('加载包装物失败')
    }
  }

  const handleStoreChange = (storeId: string) => {
    setItems([])
    if (storeId) {
      loadReturnableContainers(storeId)
    } else {
      setContainers([])
    }
  }

  const handleAddContainer = (containerId: string) => {
    const container = containers.find((c) => c.containerId === containerId)
    if (!container) {
      return
    }

    const existing = items.find((item) => item.containerId === containerId)
    if (existing) {
      message.warning('该包装物已在列表中')
      return
    }

    setItems([
      ...items,
      {
        containerId: container.containerId,
        containerName: container.containerName,
        currentBorrowed: container.currentBorrowed,
        deposit: container.deposit,
        quantity: 1,
      },
    ])
  }

  const handleQuantityChange = (index: number, value: number | null) => {
    const newItems = [...items]
    const targetItem = newItems[index]
    if (!targetItem) {
      return
    }

    targetItem.quantity = value || 0
    setItems(newItems)
  }

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
  }

  const handleSubmit = async (values: { storeId: string; remark?: string }) => {
    if (items.length === 0) {
      message.warning('请至少添加一个包装物')
      return
    }

    const invalidItem = items.find((item) => item.quantity <= 0)
    if (invalidItem) {
      message.warning('归还数量必须大于0')
      return
    }

    const overQuantityItem = items.find((item) => item.quantity > item.currentBorrowed)
    if (overQuantityItem) {
      message.warning(
        `${overQuantityItem.containerName} 归还数量(${overQuantityItem.quantity}) 超过在外数量(${overQuantityItem.currentBorrowed})`
      )
      return
    }

    startTransition(async () => {
      const result = await batchReturnContainers({
        storeId: values.storeId,
        items: items.map((item) => ({
          containerId: item.containerId,
          quantity: item.quantity,
        })),
        remark: values.remark,
      })

      if (result.success) {
        message.success('包装物归还成功')
        form.resetFields()
        setItems([])
        onSuccess?.()
      } else {
        message.error(result.message || '包装物归还失败')
      }
    })
  }

  React.useEffect(() => {
    loadStores()
  }, [])

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Row gutter={16}>
        <Col span={12}>
          <Card title="归还登记">
            <Form.Item
              name="storeId"
              label="门店"
              rules={[{ required: true, message: '请选择门店' }]}
            >
              <Select
                showSearch
                placeholder="选择门店"
                options={stores.map((s) => ({ label: s.name, value: s.id }))}
                onChange={handleStoreChange}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>

            <Divider>包装物列表</Divider>

            {items.length === 0 && containers.length > 0 && (
              <div style={{ color: '#999', padding: '20px 0', textAlign: 'center' }}>
                请从右侧选择包装物
              </div>
            )}

            {items.map((item, index) => (
              <Card key={item.containerId} size="small" style={{ marginBottom: 8 }}>
                <Row gutter={16} align="middle">
                  <Col span={8}>
                    <div>
                      <strong>{item.containerName}</strong>
                    </div>
                    <div style={{ color: '#999', fontSize: 12 }}>在外: {item.currentBorrowed}</div>
                  </Col>
                  <Col span={10}>
                    <InputNumber
                      min={1}
                      max={item.currentBorrowed}
                      value={item.quantity}
                      onChange={(val) => handleQuantityChange(index, val)}
                      suffix="个"
                      style={{ width: '100%' }}
                    />
                  </Col>
                  <Col span={6} style={{ textAlign: 'right' }}>
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveItem(index)}
                    />
                  </Col>
                </Row>
              </Card>
            ))}

            {items.length < containers.length && items.length > 0 && (
              <div style={{ color: '#999', marginTop: 8 }}>
                还可添加 {containers.length - items.length} 种包装物（请在右侧选择）
              </div>
            )}

            <Form.Item name="remark" label="备注" style={{ marginTop: 16 }}>
              <Input.TextArea rows={3} placeholder="请输入备注（可选）" />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={isPending}
              disabled={items.length === 0}
            >
              确认归还
            </Button>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="待归还清单">
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
                暂无包装物
              </div>
            ) : (
              <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                {items.map((item) => {
                  const remaining = item.currentBorrowed - item.quantity
                  return (
                    <Card key={item.containerId} size="small">
                      <Row gutter={16}>
                        <Col span={10}>
                          <div>
                            <strong>{item.containerName}</strong>
                          </div>
                          <div style={{ color: '#999', fontSize: 12 }}>
                            在外: {item.currentBorrowed}
                          </div>
                        </Col>
                        <Col span={8}>
                          <div>
                            <strong style={{ color: '#1890ff' }}>归还: {item.quantity}</strong>
                          </div>
                          <div style={{ color: '#999', fontSize: 12 }}>剩余: {remaining}</div>
                        </Col>
                        <Col span={6} style={{ textAlign: 'right' }}>
                          <div style={{ color: '#faad14', fontSize: 12 }}>押金</div>
                          <div style={{ fontSize: 14, fontWeight: 'bold' }}>
                            ¥{(remaining * item.deposit).toFixed(2)}
                          </div>
                        </Col>
                      </Row>
                    </Card>
                  )
                })}
                <Divider />
                <div style={{ textAlign: 'right' }}>
                  <Space orientation="vertical" size="small">
                    <div>
                      归还总数:{' '}
                      <strong>{items.reduce((sum, item) => sum + item.quantity, 0)} 个</strong>
                    </div>
                    <div>
                      剩余总数:{' '}
                      <strong>
                        {items.reduce(
                          (sum, item) => sum + (item.currentBorrowed - item.quantity),
                          0
                        )}{' '}
                        个
                      </strong>
                    </div>
                    <div>
                      剩余押金:{' '}
                      <strong style={{ color: '#faad14' }}>
                        ¥
                        {items
                          .reduce(
                            (sum, item) =>
                              sum + (item.currentBorrowed - item.quantity) * item.deposit,
                            0
                          )
                          .toFixed(2)}
                      </strong>
                    </div>
                  </Space>
                </div>
              </Space>
            )}
          </Card>

          {containers.length > 0 && (
            <Card title="选择包装物" style={{ marginTop: 16 }}>
              <div
                style={{
                  maxHeight: 400,
                  overflowY: 'auto',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 8,
                }}
              >
                {containers.map((container) => {
                  const isInList = items.some((item) => item.containerId === container.containerId)
                  return (
                    <Card
                      key={container.trackingId}
                      size="small"
                      hoverable
                      onClick={() => !isInList && handleAddContainer(container.containerId)}
                      style={{
                        cursor: isInList ? 'not-allowed' : 'pointer',
                        opacity: isInList ? 0.5 : 1,
                      }}
                    >
                      <div>
                        <strong>{container.containerName}</strong>
                      </div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        在外: {container.currentBorrowed}
                      </div>
                      <div style={{ fontSize: 12, color: '#faad14' }}>
                        押金: ¥{container.deposit.toFixed(2)}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </Form>
  )
}
