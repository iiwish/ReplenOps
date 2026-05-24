'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Modal,
  message,
  Card,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  StopOutlined,
  UserOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { deleteStore, toggleStoreStatus } from '@/actions/store-actions'
import type { PaginatedStoreResult } from '@/services/store.service'
import StoreFormClient from './StoreFormClient'

const { Search } = Input

interface StoreListClientProps {
  initialData: PaginatedStoreResult
}

type StoreRecord = PaginatedStoreResult['data'][number]
type StoreFormMode = 'create' | 'edit'

export default function StoreListClient({
  initialData,
}: StoreListClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [formMode, setFormMode] = useState<StoreFormMode>('create')
  const [editingStore, setEditingStore] = useState<StoreRecord | null>(null)

  const handleOpenCreateModal = () => {
    setFormMode('create')
    setEditingStore(null)
    setFormModalOpen(true)
  }

  const handleOpenEditModal = (record: StoreRecord) => {
    setFormMode('edit')
    setEditingStore(record)
    setFormModalOpen(true)
  }

  const handleCloseFormModal = () => {
    setFormModalOpen(false)
    setEditingStore(null)
  }

  const handleFormSuccess = () => {
    handleCloseFormModal()
    router.refresh()
  }

  // 搜索处理
  const handleSearch = (value: string) => {
    const params = new URLSearchParams()
    if (value) {
      params.set('keyword', value)
    }
    router.push(`/admin/stores?${params.toString()}`)
  }

  // 删除处理
  const handleDelete = (record: StoreRecord) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除门店"${record.name}"吗？此操作不可恢复。`,
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true)
        try {
          const result = await deleteStore(record.id)
          if (result.success) {
            message.success(result.message)
            router.refresh()
          } else {
            message.error(result.message || '删除失败')
          }
        } catch {
          message.error('删除失败，请重试')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  // 切换状态处理
  const handleToggleStatus = async (record: StoreRecord) => {
    setLoading(true)
    try {
      const result = await toggleStoreStatus(record.id)
      if (result.success) {
        message.success(result.message)
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

  // 表格列定义
  const columns: ColumnsType<StoreRecord> = [
    {
      title: '门店编码',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: '门店名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
    },
    {
      title: '联系人',
      dataIndex: 'contactName',
      key: 'contactName',
      width: 100,
    },
    {
      title: '联系电话',
      dataIndex: 'contactPhone',
      key: 'contactPhone',
      width: 130,
    },
    {
      title: '管理员',
      dataIndex: 'adminCount',
      key: 'adminCount',
      width: 100,
      render: (count: number) => (
        <Tag icon={<UserOutlined />} color="blue">
          {count} 人
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (isActive: boolean) =>
        isActive ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            启用
          </Tag>
        ) : (
          <Tag icon={<StopOutlined />} color="default">
            禁用
          </Tag>
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (date: Date) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEditModal(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<UserOutlined />}
            onClick={() => router.push(`/admin/stores/${record.id}/admins`)}
          >
            管理员
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleToggleStatus(record)}
            disabled={loading}
          >
            {record.isActive ? '禁用' : '启用'}
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            disabled={loading}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card variant="borderless">
        <Space
          orientation="vertical"
          size="middle"
          style={{ width: '100%' }}
        >
          {/* 顶部操作栏 */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Search
              placeholder="搜索门店名称或编码"
              allowClear
              enterButton={<SearchOutlined />}
              style={{ width: 300 }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onSearch={handleSearch}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreateModal}
            >
              新增门店
            </Button>
          </div>

          {/* 表格 */}
          <Table
            columns={columns}
            dataSource={initialData.data}
            rowKey="id"
            loading={loading}
            pagination={{
              current: initialData.page,
              pageSize: initialData.pageSize,
              total: initialData.total,
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page) => {
                const params = new URLSearchParams()
                params.set('page', page.toString())
                if (keyword) {
                  params.set('keyword', keyword)
                }
                router.push(`/admin/stores?${params.toString()}`)
              },
            }}
            scroll={{ x: 1200 }}
          />
        </Space>
      </Card>

      <Modal
        title={formMode === 'create' ? '新增门店' : '编辑门店'}
        open={formModalOpen}
        onCancel={handleCloseFormModal}
        footer={null}
        width={680}
        destroyOnHidden
      >
        {formModalOpen && (
          <StoreFormClient
            mode={formMode}
            initialValues={
              editingStore
                ? {
                    id: editingStore.id,
                    code: editingStore.code,
                    name: editingStore.name,
                    address: editingStore.address || undefined,
                    contactName: editingStore.contactName || undefined,
                    contactPhone: editingStore.contactPhone || undefined,
                  }
                : undefined
            }
            onCancel={handleCloseFormModal}
            onSuccess={handleFormSuccess}
          />
        )}
      </Modal>
    </div>
  )
}
