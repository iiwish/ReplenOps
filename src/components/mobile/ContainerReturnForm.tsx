'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  InputNumber,
  Modal,
  Space,
  Spin,
  Tag,
  message,
} from 'antd'
import { SendOutlined } from '@ant-design/icons'
import {
  cancelContainerReturn,
  getStoreContainerReturnRequests,
  getReturnableContainers,
  submitContainerReturnRequest,
} from '@/actions/container-return-actions'
import { StoreSelector } from '@/components/mobile/dashboard/StoreSelector'
import { useStoreSelectionStore } from '@/lib/stores/store-selection.store'

interface ReturnableContainer {
  trackingId: string
  containerId: string
  containerName: string
  containerUnit: string
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
  const [isPending, startTransition] = useTransition()
  const { selectedStoreId, availableStores } = useStoreSelectionStore()
  const selectedStore = availableStores.find((store) => store.id === selectedStoreId)
  const [containers, setContainers] = useState<ReturnableContainer[]>([])
  const [pendingRequests, setPendingRequests] = useState<PendingReturnRequest[]>([])
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [remark, setRemark] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const loadRequestId = useRef(0)

  const selectedItems = useMemo(
    () =>
      containers
        .map((container) => ({ container, quantity: quantities[container.containerId] ?? 0 }))
        .filter((item) => item.quantity > 0),
    [containers, quantities]
  )
  const loadContainers = useCallback(async () => {
    const requestId = ++loadRequestId.current

    if (!selectedStore?.id) {
      setContainers([])
      setPendingRequests([])
      setLoading(false)
      return
    }

    setLoading(true)
    setContainers([])
    setPendingRequests([])
    try {
      const [result, requestsResult] = await Promise.all([
        getReturnableContainers({ storeId: selectedStore.id }),
        getStoreContainerReturnRequests({ storeId: selectedStore.id, page: 1, pageSize: 20 }),
      ])

      if (requestId !== loadRequestId.current) return

      if (result.success && result.data) {
        setContainers(result.data as ReturnableContainer[])
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
      if (requestId === loadRequestId.current) {
        console.error('加载包装物失败:', error)
        message.error('加载包装物失败')
      }
    } finally {
      if (requestId === loadRequestId.current) {
        setLoading(false)
      }
    }
  }, [selectedStore?.id])

  const updateQuantity = (container: ReturnableContainer, quantity: number) => {
    const normalized = Math.max(0, Math.min(quantity, container.availableReturnQuantity))
    setQuantities((current) => ({ ...current, [container.containerId]: normalized }))
  }

  const handleSubmit = () => {
    if (!selectedStore?.id || selectedItems.length === 0) return

    startTransition(async () => {
      const result = await submitContainerReturnRequest({
        storeId: selectedStore.id,
        items: selectedItems.map(({ container, quantity }) => ({
          containerId: container.containerId,
          quantity,
        })),
        remark: remark.trim() || undefined,
      })

      if (result.success) {
        message.success('归还申请已提交，等待仓库验收')
        setShowConfirm(false)
        setQuantities({})
        setRemark('')
        await loadContainers()
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
    setQuantities({})
    setRemark('')
    setShowConfirm(false)
    void loadContainers()
  }, [loadContainers])

  return (
    <section className="min-h-full bg-gray-50 px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3">
        <div className="text-sm font-medium text-gray-700">归还门店</div>
        <StoreSelector />
      </div>

      {!selectedStore ? (
        <div className="rounded-lg border border-gray-200 bg-white py-12">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={availableStores.length === 0 ? '当前账号没有可操作门店' : '请先选择门店'}
          />
        </div>
      ) : loading ? (
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
          <Spin />
          <div className="mt-2 text-sm text-gray-500">正在加载包装物</div>
        </div>
      ) : containers.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-12">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前门店暂无可归还包装物" />
        </div>
      ) : (
        <Space orientation="vertical" size={10} style={{ width: '100%' }}>
          {containers.map((container) => {
            const quantity = quantities[container.containerId] ?? 0
            const isSelected = quantity > 0

            return (
              <Card key={container.trackingId} size="small" loading={loading}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-gray-900">
                      {container.containerName}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      当前在外 {container.currentBorrowed} {container.containerUnit}
                      {container.pendingReturnQuantity > 0 && (
                        <span>
                          ，待验收 {container.pendingReturnQuantity} {container.containerUnit}
                        </span>
                      )}
                    </div>
                  </div>
                  <Tag color={container.availableReturnQuantity > 0 ? 'blue' : 'default'}>
                    可归还 {container.availableReturnQuantity} {container.containerUnit}
                  </Tag>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                  <Checkbox
                    checked={isSelected}
                    disabled={container.availableReturnQuantity <= 0}
                    onChange={(event) =>
                      updateQuantity(
                        container,
                        event.target.checked ? container.availableReturnQuantity : 0
                      )
                    }
                  >
                    加入本次归还
                  </Checkbox>
                  <InputNumber
                    aria-label={`${container.containerName}归还数量`}
                    min={1}
                    max={container.availableReturnQuantity}
                    precision={0}
                    disabled={!isSelected}
                    value={isSelected ? quantity : null}
                    suffix={container.containerUnit}
                    onChange={(value) => updateQuantity(container, value ?? 0)}
                    style={{ width: 118 }}
                  />
                </div>
              </Card>
            )
          })}
        </Space>
      )}

      {pendingRequests.length > 0 && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
          <h2 className="m-0 text-base font-semibold">待仓库验收</h2>
          <div className="mt-3 divide-y divide-gray-100">
            {pendingRequests.map((request) => (
              <div key={request.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{request.code}</div>
                  <div className="mt-1 text-xs leading-5 text-gray-500">
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
        </div>
      )}

      {selectedItems.length > 0 && (
        <div className="sticky bottom-20 z-20 mt-4 rounded-lg border border-blue-200 bg-white p-3 shadow-lg">
          <Button
            type="primary"
            size="large"
            block
            icon={<SendOutlined />}
            onClick={() => setShowConfirm(true)}
          >
            提交 {selectedItems.length} 种包装物
          </Button>
        </div>
      )}

      <Modal
        title="确认归还申请"
        open={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onOk={handleSubmit}
        okText="提交申请"
        cancelText="继续修改"
        confirmLoading={isPending}
        width="calc(100% - 32px)"
        style={{ maxWidth: 440 }}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            {selectedItems.map(({ container, quantity }) => (
              <div key={container.containerId} className="flex justify-between gap-3 py-1">
                <span>{container.containerName}</span>
                <strong>
                  {quantity} {container.containerUnit}
                </strong>
              </div>
            ))}
          </div>
          <Input.TextArea
            rows={3}
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
            placeholder="归还备注（可选）"
            maxLength={500}
            showCount
          />
        </Space>
      </Modal>
    </section>
  )
}
