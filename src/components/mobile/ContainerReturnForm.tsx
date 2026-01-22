'use client'

import { useState, useEffect, useTransition } from 'react'
import { Card, Button, InputNumber, Modal, Form, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { batchReturnContainers, getReturnableContainers } from '@/actions/container-return-actions'
import { useStoreSelectionStore } from '@/lib/stores/store-selection.store'

interface ReturnableContainer {
  trackingId: string
  containerId: string
  containerName: string
  currentBorrowed: number
  deposit: number
}

interface MobileContainerReturnFormProps {
  onSuccess?: () => void
}

export function MobileContainerReturnForm({ onSuccess }: MobileContainerReturnFormProps) {
  const [form] = Form.useForm()
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { selectedStoreId, availableStores } = useStoreSelectionStore()

  const selectedStore = availableStores.find((s) => s.id === selectedStoreId)

  const [containers, setContainers] = useState<ReturnableContainer[]>([])
  const [selectedContainer, setSelectedContainer] = useState<ReturnableContainer | null>(null)
  const [showModal, setShowModal] = useState(false)

  const loadContainers = async () => {
    if (!selectedStore?.id) {
      message.error('未选择门店')
      return
    }

    try {
      const result = await getReturnableContainers({ storeId: selectedStore.id })
      if (result.success && result.data) {
        const data = result.data as unknown as ReturnableContainer[]
        setContainers(data)
      } else {
        message.error(result.message || '加载包装物失败')
      }
    } catch (error) {
      console.error('加载包装物失败:', error)
      message.error('加载包装物失败')
    }
  }

  const handleContainerSelect = (container: ReturnableContainer) => {
    setSelectedContainer(container)
    setShowModal(true)
  }

  const handleReturnAll = () => {
    if (selectedContainer) {
      form.setFieldValue('quantity', selectedContainer.currentBorrowed)
    }
  }

  const handleSubmit = async (values: { quantity: number; remark?: string }) => {
    if (!selectedContainer || !selectedStore?.id) {
      return
    }

    startTransition(async () => {
      const result = await batchReturnContainers({
        storeId: selectedStore.id,
        items: [
          {
            containerId: selectedContainer.containerId,
            quantity: values.quantity,
          },
        ],
        remark: values.remark,
      })

      if (result.success) {
        message.success('包装物归还成功，感谢您的配合！')
        setShowModal(false)
        setSelectedContainer(null)
        form.resetFields()
        loadContainers()
        onSuccess?.()
      } else {
        message.error(result.message || '包装物归还失败')
      }
    })
  }

  useEffect(() => {
    loadContainers()
  }, [selectedStore?.id])

  return (
    <div style={{ padding: '16px', minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()} style={{ fontSize: 16 }}>
          返回
        </Button>
        <h1 style={{ flex: 1, textAlign: 'center', fontSize: 20, margin: 0 }}>包装物归还</h1>
      </div>

      <Card>
        <div style={{ marginBottom: 16, padding: '8px 0' }}>
          <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>当前门店</div>
          <div style={{ fontSize: 18, fontWeight: 'bold' }}>{selectedStore?.name || '未选择'}</div>
        </div>

        {containers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
            暂无可归还的包装物
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
            }}
          >
            {containers.map((container) => (
              <Card
                key={container.trackingId}
                hoverable
                onClick={() => handleContainerSelect(container)}
                style={{
                  textAlign: 'center',
                  minHeight: 120,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
                  {container.containerName}
                </div>
                <div
                  style={{
                    fontSize: 24,
                    color: '#faad14',
                    fontWeight: 'bold',
                    marginBottom: 8,
                  }}
                >
                  {container.currentBorrowed}
                  <span style={{ fontSize: 14, marginLeft: 4 }}>个</span>
                </div>
                <div style={{ fontSize: 14, color: '#999' }}>在外数量</div>
                <div
                  style={{
                    fontSize: 16,
                    color: '#faad14',
                    marginTop: 8,
                  }}
                >
                  押金: ¥{container.deposit.toFixed(2)}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Modal
        title={`归还 ${selectedContainer?.containerName}`}
        open={showModal}
        onCancel={() => setShowModal(false)}
        footer={null}
        width="90%"
        style={{ maxWidth: 400 }}
      >
        {selectedContainer && (
          <Form form={form} onFinish={handleSubmit} layout="vertical">
            <div
              style={{
                textAlign: 'center',
                marginBottom: 24,
                padding: '16px',
                backgroundColor: '#f6ffed',
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>当前在外数量</div>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 'bold',
                  color: '#faad14',
                }}
              >
                {selectedContainer.currentBorrowed}
                <span style={{ fontSize: 20, marginLeft: 8 }}>个</span>
              </div>
              <div style={{ fontSize: 16, color: '#faad14', marginTop: 8 }}>
                押金: ¥{(selectedContainer.currentBorrowed * selectedContainer.deposit).toFixed(2)}
              </div>
            </div>

            <Form.Item
              name="quantity"
              label="归还数量"
              rules={[
                { required: true, message: '请输入归还数量' },
                {
                  type: 'number',
                  min: 1,
                  max: selectedContainer.currentBorrowed,
                  message: `归还数量必须在1-${selectedContainer.currentBorrowed}之间`,
                },
              ]}
            >
              <InputNumber
                style={{ width: '100%', fontSize: 24, height: 50 }}
                placeholder="输入归还数量"
                min={1}
                max={selectedContainer.currentBorrowed}
                size="large"
              />
            </Form.Item>

            <div style={{ marginBottom: 16 }}>
              <Button
                block
                size="large"
                onClick={handleReturnAll}
                style={{
                  fontSize: 16,
                  height: 50,
                  backgroundColor: '#e6f7ff',
                  borderColor: '#e6f7ff',
                }}
              >
                全部归还 ({selectedContainer.currentBorrowed})
              </Button>
            </div>

            <Form.Item name="remark" label="备注（可选）">
              <input
                style={{
                  width: '100%',
                  fontSize: 16,
                  padding: 12,
                  border: '1px solid #d9d9d9',
                  borderRadius: 4,
                }}
                placeholder="请输入备注"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={isPending}
                style={{ fontSize: 18, height: 56 }}
              >
                确认归还
              </Button>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}
