'use client'

import { useState } from 'react'
import TableActions from '@/components/admin/TableActions'
import { useRouter } from 'next/navigation'
import { Button, Input, Tag, Modal, message, Card } from 'antd'
import { PlusOutlined, SearchOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { deleteWarehouse, toggleWarehouseStatus } from '@/actions/warehouse-actions'
import type { PaginatedWarehouseResult } from '@/services/warehouse.service'
import ActionTextButton from '@/components/admin/ActionTextButton'
import AdminListTable from '@/components/admin/AdminListTable'
import WarehouseFormClient from './WarehouseFormClient'

const { Search } = Input

interface WarehouseListClientProps {
  initialData: PaginatedWarehouseResult
}

type WarehouseRecord = PaginatedWarehouseResult['data'][number]
type WarehouseFormMode = 'create' | 'edit'

export default function WarehouseListClient({ initialData }: WarehouseListClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [formMode, setFormMode] = useState<WarehouseFormMode>('create')
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRecord | null>(null)

  const handleOpenCreateModal = () => {
    setFormMode('create')
    setEditingWarehouse(null)
    setFormModalOpen(true)
  }

  const handleOpenEditModal = (record: WarehouseRecord) => {
    setFormMode('edit')
    setEditingWarehouse(record)
    setFormModalOpen(true)
  }

  const handleCloseFormModal = () => {
    setFormModalOpen(false)
    setEditingWarehouse(null)
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
    router.push(`/admin/warehouse?${params.toString()}`)
  }

  // 删除处理
  const handleDelete = (record: WarehouseRecord) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除仓库"${record.name}"吗？此操作不可恢复。`,
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true)
        try {
          const result = await deleteWarehouse(record.id)
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
  const handleToggleStatus = async (record: WarehouseRecord) => {
    setLoading(true)
    try {
      const result = await toggleWarehouseStatus(record.id)
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
  const columns: ColumnsType<WarehouseRecord> = [
    {
      title: '仓库编码',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: '仓库名称',
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
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <TableActions>
          <ActionTextButton label="编辑" onClick={() => handleOpenEditModal(record)} />
          <ActionTextButton
            label={record.isActive ? '禁用' : '启用'}
            onClick={() => handleToggleStatus(record)}
            disabled={loading}
          />
          <ActionTextButton
            danger
            label="删除"
            onClick={() => handleDelete(record)}
            disabled={loading}
          />
        </TableActions>
      ),
    },
  ]

  return (
    <div className="admin-list-page">
      <Card variant="borderless" className="admin-list-card">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          {/* 顶部操作栏 */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
            <Search
              placeholder="搜索仓库名称或编码"
              allowClear
              enterButton={<SearchOutlined />}
              style={{ width: 300 }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onSearch={handleSearch}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateModal}>
              新增仓库
            </Button>
          </div>

          {/* 表格 */}
          <div className="admin-list-table-frame">
            <AdminListTable
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
                  router.push(`/admin/warehouse?${params.toString()}`)
                },
              }}
              scroll={{ x: 1200 }}
            />
          </div>
        </div>
      </Card>

      <Modal
        title={formMode === 'create' ? '新增仓库' : '编辑仓库'}
        open={formModalOpen}
        onCancel={handleCloseFormModal}
        footer={null}
        width={680}
        destroyOnHidden
      >
        {formModalOpen && (
          <WarehouseFormClient
            mode={formMode}
            initialValues={
              editingWarehouse
                ? {
                    id: editingWarehouse.id,
                    code: editingWarehouse.code,
                    name: editingWarehouse.name,
                    address: editingWarehouse.address || undefined,
                    contactName: editingWarehouse.contactName || '',
                    contactPhone: editingWarehouse.contactPhone || '',
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
