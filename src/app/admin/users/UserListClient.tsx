'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Input, Space, Tag, Dropdown, App } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  StopOutlined,
  MoreOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import { deleteUser, toggleUserStatus } from '@/actions/user-actions'
import type { PaginatedUserResult } from '@/actions/user-actions'
import { UserFormModal } from './UserFormModal'
import type { UserWithRoles } from '@/services/user.service'
import { formatUserCode } from '@/lib/user-code'

const { Search } = Input

interface UserListClientProps {
  initialData: PaginatedUserResult
  stores: Array<{ id: string; code: string; name: string }>
  currentUserId: string
}

type UserRecord = UserWithRoles

const roleLabels: Record<string, { color: string; label: string }> = {
  SUPER_ADMIN: { color: 'red', label: '超级管理员' },
  WAREHOUSE_MANAGER: { color: 'blue', label: '仓库管理员' },
  STORE_ADMIN: { color: 'green', label: '门店管理员' },
}

export default function UserListClient({
  initialData,
  stores,
  currentUserId,
}: UserListClientProps) {
  const router = useRouter()
  const { message, modal } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)

  const handleSearch = (value: string) => {
    const params = new URLSearchParams()
    params.set('page', '1')
    if (value) {
      params.set('keyword', value)
    }
    router.push(`/admin/users?${params.toString()}`)
  }

  const handleDelete = (record: UserRecord) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除用户"${record.username}"吗？此操作不可恢复。`,
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true)
        try {
          const result = await deleteUser(record.id)
          if (result.success) {
            message.success(result.message)
            router.refresh()
          } else {
            message.error(result.error || '删除失败')
          }
        } catch {
          message.error('删除失败，请重试')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  const executeToggleStatus = async (record: UserRecord) => {
    setLoading(true)
    try {
      const result = await toggleUserStatus(record.id)
      if (result.success) {
        message.success(result.message)
        router.refresh()
      } else {
        message.error(result.error || '操作失败')
      }
    } catch {
      message.error('操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = (record: UserRecord) => {
    if (!record.isActive) {
      void executeToggleStatus(record)
      return
    }

    modal.confirm({
      title: '确认禁用用户？',
      content: `禁用“${record.username}”后，该用户的现有登录会话将失效。`,
      okText: '确认禁用',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => executeToggleStatus(record),
    })
  }

  const handleOpenCreateModal = () => {
    setEditingUser(null)
    setFormModalOpen(true)
  }

  const handleOpenEditModal = (record: UserRecord) => {
    setEditingUser(record)
    setFormModalOpen(true)
  }

  const handleFormModalClose = () => {
    setFormModalOpen(false)
    setEditingUser(null)
  }

  const handleFormModalSuccess = () => {
    setFormModalOpen(false)
    setEditingUser(null)
    router.refresh()
  }

  const columns: ColumnsType<UserRecord> = [
    {
      title: '用户编码',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      render: (code: number) => formatUserCode(code),
    },
    {
      title: '登录名',
      dataIndex: 'username',
      key: 'username',
      width: 150,
      render: (username: string, record) => (
        <div className="flex flex-col items-start gap-1">
          <span className="whitespace-nowrap">{username}</span>
          {record.id === currentUserId && <Tag color="blue">当前用户</Tag>}
        </div>
      ),
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      render: (name: string | null) => name || '-',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      render: (phone: string | null) => phone || '-',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 180,
      ellipsis: true,
      render: (email: string | null) => email || '-',
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      width: 170,
      render: (roles: string[]) => (
        <Space size={4} wrap>
          {roles.length > 0 ? (
            roles.map((role) => {
              const config = roleLabels[role] || { color: 'default', label: role }
              return (
                <Tag key={role} color={config.color}>
                  {config.label}
                </Tag>
              )
            })
          ) : (
            <Tag>无角色</Tag>
          )}
        </Space>
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
      width: 160,
      render: (date: Date) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 115,
      fixed: 'right',
      render: (_, record) => {
        const isCurrentUser = record.id === currentUserId
        const menuItems: MenuProps['items'] = [
          {
            key: 'status',
            icon: record.isActive ? <StopOutlined /> : <CheckCircleOutlined />,
            label: record.isActive ? '禁用用户' : '启用用户',
            disabled: loading || (isCurrentUser && record.isActive),
            onClick: () => handleToggleStatus(record),
          },
          { type: 'divider' },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: '删除用户',
            danger: true,
            disabled: loading || isCurrentUser,
            onClick: () => handleDelete(record),
          },
        ]

        return (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEditModal(record)}
            >
              编辑
            </Button>
            <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
              <Button
                type="text"
                size="small"
                icon={<MoreOutlined />}
                aria-label={`更多用户操作：${record.username}`}
                title="更多操作"
              />
            </Dropdown>
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      <div>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Search
              placeholder="搜索登录名、姓名、手机号或邮箱"
              allowClear
              enterButton={<SearchOutlined aria-label="搜索用户" />}
              style={{ width: 350 }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onSearch={handleSearch}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateModal}>
              新增用户
            </Button>
          </div>

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
                router.push(`/admin/users?${params.toString()}`)
              },
            }}
            scroll={{ x: 1175 }}
          />
        </Space>
      </div>

      <UserFormModal
        open={formModalOpen}
        user={editingUser}
        stores={stores}
        onClose={handleFormModalClose}
        onSuccess={handleFormModalSuccess}
      />
    </div>
  )
}
