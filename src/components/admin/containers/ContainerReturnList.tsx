'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd'
import { CheckOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  completeContainerReturn,
  getContainerReturnRequests,
  rejectContainerReturn,
} from '@/actions/container-return-actions'

type ReturnStatus = 'PENDING' | 'COMPLETED' | 'REJECTED' | 'CANCELLED'

interface ReturnRequestItem {
  id: string
  containerId: string
  containerCode: string
  containerName: string
  containerUnit: string
  requestedQuantity: number
  receivedQuantity: number | null
}

interface ReturnRequest {
  id: string
  code: string
  storeId: string
  storeName: string
  status: ReturnStatus
  remark: string | null
  submittedBy: string
  submittedByName: string
  submittedAt: Date
  reviewedBy: string | null
  reviewedByName: string | null
  reviewedAt: Date | null
  reviewReason: string | null
  items: ReturnRequestItem[]
}

interface RequestsResult {
  data: ReturnRequest[]
  total: number
}

interface ContainerReturnListProps {
  storeId?: string
  containerId?: string
  canWriteStock: boolean
}

const statusMeta: Record<ReturnStatus, { text: string; color: string }> = {
  PENDING: { text: '待验收', color: 'processing' },
  COMPLETED: { text: '已验收', color: 'success' },
  REJECTED: { text: '已驳回', color: 'error' },
  CANCELLED: { text: '已取消', color: 'default' },
}

export function ContainerReturnList({
  storeId,
  containerId,
  canWriteStock,
}: ContainerReturnListProps) {
  const [form] = Form.useForm()
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([])
  const [containers, setContainers] = useState<Array<{ id: string; name: string }>>([])
  const [requests, setRequests] = useState<ReturnRequest[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [accepting, setAccepting] = useState<ReturnRequest | null>(null)
  const [received, setReceived] = useState<Record<string, number>>({})
  const [acceptRemark, setAcceptRemark] = useState('')
  const [rejecting, setRejecting] = useState<ReturnRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const loadRequests = useCallback(
    async (currentPage: number, currentPageSize: number) => {
      setLoading(true)
      try {
        const values = form.getFieldsValue()
        const result = await getContainerReturnRequests({
          storeId: values.storeId,
          containerId: values.containerId,
          status: values.status,
          dateFrom: values.dateFrom?.format('YYYY-MM-DD'),
          dateTo: values.dateTo?.format('YYYY-MM-DD'),
          page: currentPage,
          pageSize: currentPageSize,
        })
        if (result.success && result.data) {
          const data = result.data as RequestsResult
          setRequests(data.data)
          setTotal(data.total)
        } else {
          message.error(result.message || '加载归还申请失败')
        }
      } finally {
        setLoading(false)
      }
    },
    [form]
  )

  useEffect(() => {
    form.setFieldsValue({ storeId, containerId, status: 'PENDING' })
    void Promise.all([
      fetch('/api/stores/user', { cache: 'no-store' }).then((response) => response.json()),
      fetch('/api/containers', { cache: 'no-store' }).then((response) => response.json()),
    ])
      .then(([storeResult, containerResult]) => {
        if (storeResult.success && storeResult.data) setStores(storeResult.data)
        if (Array.isArray(containerResult)) setContainers(containerResult)
      })
      .catch(() => message.error('加载筛选项失败'))
    void loadRequests(1, 20)
  }, [containerId, form, loadRequests, storeId])

  const openAccept = (request: ReturnRequest) => {
    setAccepting(request)
    setAcceptRemark('')
    setReceived(Object.fromEntries(request.items.map((item) => [item.id, item.requestedQuantity])))
  }

  const submitAccept = async () => {
    if (!accepting) return
    setLoading(true)
    try {
      const result = await completeContainerReturn({
        returnId: accepting.id,
        items: accepting.items.map((item) => ({
          itemId: item.id,
          receivedQuantity: received[item.id] ?? 0,
        })),
        remark: acceptRemark || undefined,
      })
      if (!result.success) {
        message.error(result.message || '验收失败')
        return
      }
      message.success(result.message)
      setAccepting(null)
      await loadRequests(page, pageSize)
    } finally {
      setLoading(false)
    }
  }

  const submitReject = async () => {
    if (!rejecting || !rejectReason.trim()) {
      message.warning('请填写驳回原因')
      return
    }
    setLoading(true)
    try {
      const result = await rejectContainerReturn({
        returnId: rejecting.id,
        reason: rejectReason,
      })
      if (!result.success) {
        message.error(result.message || '驳回失败')
        return
      }
      message.success(result.message)
      setRejecting(null)
      setRejectReason('')
      await loadRequests(page, pageSize)
    } finally {
      setLoading(false)
    }
  }

  const columns: ColumnsType<ReturnRequest> = [
    { title: '归还单号', dataIndex: 'code', width: 180 },
    { title: '门店', dataIndex: 'storeName', width: 140 },
    {
      title: '包装物种类',
      width: 100,
      render: (_, request) => `${request.items.length} 种`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: ReturnStatus) => (
        <Tag color={statusMeta[status].color}>{statusMeta[status].text}</Tag>
      ),
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      width: 170,
      render: (date: Date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    { title: '提交人', dataIndex: 'submittedByName', width: 110 },
    {
      title: '处理人',
      dataIndex: 'reviewedByName',
      width: 110,
      render: (name: string | null) => name || '-',
    },
    {
      title: '备注/处理原因',
      ellipsis: true,
      render: (_, request) => request.reviewReason || request.remark || '-',
    },
    {
      title: '操作',
      width: 170,
      fixed: 'right',
      render: (_, request) =>
        canWriteStock && request.status === 'PENDING' ? (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => openAccept(request)}
            >
              验收
            </Button>
            <Button
              danger
              size="small"
              icon={<StopOutlined />}
              onClick={() => {
                setRejecting(request)
                setRejectReason('')
              }}
            >
              驳回
            </Button>
          </Space>
        ) : (
          '-'
        ),
    },
  ]

  return (
    <>
      <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="storeId">
          <Select
            placeholder="选择门店"
            style={{ width: 150 }}
            allowClear
            showSearch
            optionFilterProp="label"
            options={stores.map((store) => ({ label: store.name, value: store.id }))}
          />
        </Form.Item>
        <Form.Item name="containerId">
          <Select
            placeholder="选择包装物"
            style={{ width: 150 }}
            allowClear
            showSearch
            optionFilterProp="label"
            options={containers.map((container) => ({
              label: container.name,
              value: container.id,
            }))}
          />
        </Form.Item>
        <Form.Item name="status">
          <Select
            placeholder="处理状态"
            style={{ width: 120 }}
            allowClear
            options={Object.entries(statusMeta).map(([value, meta]) => ({
              value,
              label: meta.text,
            }))}
          />
        </Form.Item>
        <Form.Item name="dateFrom">
          <DatePicker placeholder="开始日期" />
        </Form.Item>
        <Form.Item name="dateTo">
          <DatePicker placeholder="结束日期" />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button
              type="primary"
              onClick={() => {
                setPage(1)
                void loadRequests(1, pageSize)
              }}
            >
              查询
            </Button>
            <Button
              onClick={() => {
                form.resetFields()
                form.setFieldValue('status', 'PENDING')
                setPage(1)
                void loadRequests(1, pageSize)
              }}
            >
              重置
            </Button>
            <Button
              icon={<ReloadOutlined />}
              aria-label="刷新"
              onClick={() => void loadRequests(page, pageSize)}
            />
          </Space>
        </Form.Item>
      </Form>

      <Table
        columns={columns}
        dataSource={requests}
        rowKey="id"
        loading={loading}
        locale={{
          emptyText: (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有符合条件的归还申请" />
          ),
        }}
        scroll={{ x: 1270 }}
        expandable={{
          expandedRowRender: (request) => (
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={request.items}
              columns={[
                { title: '包装物编码', dataIndex: 'containerCode' },
                { title: '包装物', dataIndex: 'containerName' },
                {
                  title: '申请数量',
                  render: (_value, item) => `${item.requestedQuantity} ${item.containerUnit}`,
                },
                {
                  title: '实收数量',
                  dataIndex: 'receivedQuantity',
                  render: (value: number | null, item) =>
                    value === null ? '-' : `${value} ${item.containerUnit}`,
                },
              ]}
            />
          ),
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (count) => `共 ${count} 条`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage)
            setPageSize(nextPageSize)
            void loadRequests(nextPage, nextPageSize)
          },
        }}
      />

      <Modal
        title={accepting ? `验收归还单 ${accepting.code}` : '验收归还单'}
        open={Boolean(accepting)}
        onCancel={() => setAccepting(null)}
        onOk={() => void submitAccept()}
        confirmLoading={loading}
        okText="确认验收"
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {accepting?.items.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ flex: 1 }}>{item.containerName}</span>
              <span>
                申请 {item.requestedQuantity} {item.containerUnit}
              </span>
              <InputNumber
                min={0}
                max={item.requestedQuantity}
                precision={0}
                value={received[item.id]}
                suffix={item.containerUnit}
                onChange={(value) =>
                  setReceived((current) => ({ ...current, [item.id]: value ?? 0 }))
                }
              />
            </div>
          ))}
          <Input.TextArea
            rows={3}
            value={acceptRemark}
            onChange={(event) => setAcceptRemark(event.target.value)}
            placeholder="验收备注（可选）"
          />
        </Space>
      </Modal>

      <Modal
        title={rejecting ? `驳回归还单 ${rejecting.code}` : '驳回归还单'}
        open={Boolean(rejecting)}
        onCancel={() => setRejecting(null)}
        onOk={() => void submitReject()}
        confirmLoading={loading}
        okButtonProps={{ danger: true }}
        okText="确认驳回"
      >
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          placeholder="请输入驳回原因"
        />
      </Modal>
    </>
  )
}
