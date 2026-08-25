'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Card, Button, Input, InputNumber, Modal, Form, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import {
  cancelContainerReturn,
  getStoreContainerReturnRequests,
  getReturnableContainers,
  submitContainerReturnRequest,
} from '@/actions/container-return-actions'
import { useStoreSelectionStore } from '@/lib/stores/store-selection.store'

interface ReturnableContainer {
  trackingId: string
  containerId: string
  containerName: string
  currentBorrowed: number
  pendingReturnQuantity: number
  availableReturnQuantity: number
  deposit: number
}

interface MobileContainerReturnFormProps {
  onSuccess?: () => void
}

interface PendingReturnRequest {
  id: string
  code: string
  submittedAt: Date
  items: Array<{
    id: string
    containerName: string
    requestedQuantity: number
    containerUnit: string
  }>
}

export function MobileContainerReturnForm({ onSuccess }: MobileContainerReturnFormProps) {
  const [form] = Form.useForm()
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { selectedStoreId, availableStores } = useStoreSelectionStore()

  const selectedStore = availableStores.find((s) => s.id === selectedStoreId)

  const [containers, setContainers] = useState<ReturnableContainer[]>([])
  const [pendingRequests, setPendingRequests] = useState<PendingReturnRequest[]>([])
  const [selectedContainer, setSelectedContainer] = useState<ReturnableContainer | null>(null)
  const [showModal, setShowModal] = useState(false)

  const loadContainers = useCallback(async () => {
    if (!selectedStore?.id) {
      message.error('未选择门店')
      return
    }

    try {
      const [result, requestsResult] = await Promise.all([
        getReturnableContainers({ storeId: selectedStore.id }),
        getStoreContainerReturnRequests({ storeId: selectedStore.id, page: 1, pageSize: 20 }),
      ])
      if (result.success && result.data) {
        const data = result.data as ReturnableContainer[]
        setContainers(data)
      } else {
        message.error(result.message || '加载包装物失败')
      }
      if (requestsResult.success && requestsResult.data) {
        const requestData = requestsResult.data as { data: PendingReturnRequest[] }
        setPendingRequests(requestData.data)
      } else {
        message.error(requestsResult.message || '加载待验收申请失败')
      }
    } catch (error) {
      console.error('加载包装物失败:', error)
      message.error('加载包装物失败')
    }
  }, [selectedStore])

  const handleContainerSelect = (container: ReturnableContainer) => {
    if (container.availableReturnQuantity <= 0) return
    setSelectedContainer(container)
    setShowModal(true)
  }

  const handleReturnAll = () => {
    if (selectedContainer) {
      form.setFieldValue('quantity', selectedContainer.availableReturnQuantity)
    }
  }

  const handleSubmit = async (values: { quantity: number; remark?: string }) => {
    if (!selectedContainer || !selectedStore?.id) {
      return
    }

    startTransition(async () => {
      const result = await submitContainerReturnRequest({
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
        message.success('归还申请已提交，等待仓库验收')
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

  const handleCancelRequest = (request: PendingReturnRequest) => {
    if (!selectedStore?.id) return
    Modal.confirm({
      title: '撤回归还申请',
      content: `确定撤回归还单 ${request.code} 吗？`,
      okText: '确认撤回',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        const result = await cancelContainerReturn({
          returnId: request.id,
          storeId: selectedStore.id,
        })
        if (!result.success) {
          message.error(result.message || '撤回失败')
          return
        }
        message.success(result.message)
        await loadContainers()
      },
    })
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadContainers()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadContainers])

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
                hoverable={container.availableReturnQuantity > 0}
                onClick={() => handleContainerSelect(container)}
                style={{
                  textAlign: 'center',
                  minHeight: 120,
                  opacity: container.availableReturnQuantity > 0 ? 1 : 0.65,
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
                  {container.availableReturnQuantity}
                  <span style={{ fontSize: 14, marginLeft: 4 }}>个</span>
                </div>
                <div style={{ fontSize: 14, color: '#999' }}>
                  {container.availableReturnQuantity > 0 ? '可申请归还' : '全部等待仓库验收'}
                </div>
                {container.pendingReturnQuantity > 0 && (
                  <div style={{ fontSize: 13, color: '#1677ff', marginTop: 4 }}>
                    待验收 {container.pendingReturnQuantity} 个
                  </div>
                )}
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

      {pendingRequests.length > 0 && (
        <Card title="待仓库验收" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  paddingBottom: 12,
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{request.code}</div>
                  <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
                    {request.items
                      .map(
                        (item) =>
                          `${item.containerName} ${item.requestedQuantity}${item.containerUnit}`
                      )
                      .join('，')}
                  </div>
                </div>
                <Button danger size="small" onClick={() => handleCancelRequest(request)}>
                  撤回
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

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
              <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>可申请归还数量</div>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 'bold',
                  color: '#faad14',
                }}
              >
                {selectedContainer.availableReturnQuantity}
                <span style={{ fontSize: 20, marginLeft: 8 }}>个</span>
              </div>
              <div style={{ fontSize: 16, color: '#faad14', marginTop: 8 }}>
                当前在外 {selectedContainer.currentBorrowed} 个
                {selectedContainer.pendingReturnQuantity > 0
                  ? `，其中 ${selectedContainer.pendingReturnQuantity} 个待验收`
                  : ''}
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
                  max: selectedContainer.availableReturnQuantity,
                  message: `归还数量必须在1-${selectedContainer.availableReturnQuantity}之间`,
                },
              ]}
            >
              <InputNumber
                style={{ width: '100%', fontSize: 24, height: 50 }}
                placeholder="输入归还数量"
                min={1}
                max={selectedContainer.availableReturnQuantity}
                precision={0}
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
                全部申请归还 ({selectedContainer.availableReturnQuantity})
              </Button>
            </div>

            <Form.Item name="remark" label="备注（可选）">
              <Input.TextArea rows={3} placeholder="请输入备注" />
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
                提交归还申请
              </Button>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}
