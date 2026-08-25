'use client'

import { Modal, Alert, Form, Input, Button, Space, List, Typography, Spin, message } from 'antd'
import { useState, useEffect } from 'react'
import { getRevokePreview } from '@/actions/order-revocation-actions'

const { Text } = Typography

export interface RevokeOrderModalProps {
  visible: boolean
  orderId: string
  onConfirm: (reason: string) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export function RevokeOrderModal({
  visible,
  orderId,
  onConfirm,
  onCancel,
  loading = false,
}: RevokeOrderModalProps) {
  const [form] = Form.useForm()
  const [previewLoading, setPreviewLoading] = useState(false)
  const [items, setItems] = useState<Array<{ name: string; quantity: number }>>([])
  const [containers, setContainers] = useState<Array<{ name: string; quantity: number }>>([])

  useEffect(() => {
    if (visible && orderId) {
      loadPreview()
    }
  }, [visible, orderId])

  const loadPreview = async () => {
    setPreviewLoading(true)
    try {
      const result = await getRevokePreview(orderId)
      if (result.success && result.data) {
        setItems(
          result.data.items.map((item) => ({ name: item.goodsName, quantity: item.quantity }))
        )
        setContainers(
          result.data.containers.map((c) => ({ name: c.containerName, quantity: c.quantity }))
        )
      } else if (result.error) {
        message.error(result.error)
      }
    } catch (error) {
      console.error('加载撤销预览失败:', error)
      message.error('加载撤销预览失败')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      await onConfirm(values.reason as string)
      form.resetFields()
    } catch (error) {
      console.error('表单验证失败:', error)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    onCancel()
  }

  return (
    <Modal
      title={<span style={{ color: '#ff4d4f' }}>⚠️ 撤销订单警告</span>}
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={600}
    >
      <Spin spinning={previewLoading}>
        <Form form={form} layout="vertical">
          <Alert
            message="此操作将撤销订单并回滚库存，无法恢复，请谨慎操作！"
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />

          {items.length > 0 && (
            <Form.Item label="将要回滚的库存">
              <List
                size="small"
                dataSource={items}
                renderItem={(item) => (
                  <List.Item>
                    <Space>
                      <Text>{item.name}</Text>
                      <Text type="secondary">x {item.quantity}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Form.Item>
          )}

          {containers.length > 0 && (
            <Form.Item label="将要归还的包装物">
              <List
                size="small"
                dataSource={containers}
                renderItem={(item) => (
                  <List.Item>
                    <Space>
                      <Text>{item.name}</Text>
                      <Text type="secondary">x {item.quantity}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Form.Item>
          )}

          <Form.Item
            name="reason"
            label="撤销原因"
            rules={[
              { required: true, message: '请输入撤销原因' },
              { min: 3, message: '撤销原因至少 3 个字符' },
              { max: 500, message: '撤销原因不能超过 500 字' },
            ]}
          >
            <Input.TextArea
              rows={4}
              placeholder="请详细说明撤销原因..."
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCancel} disabled={loading || previewLoading}>
                取消
              </Button>
              <Button
                type="primary"
                danger
                htmlType="submit"
                onClick={handleSubmit}
                loading={loading || previewLoading}
              >
                确认撤销
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  )
}
