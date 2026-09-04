'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Modal, Card, Space, Tag, Select, Avatar, Spin, App } from 'antd'
import { DeleteOutlined, ArrowLeftOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { addStoreAdmin, removeStoreAdmin } from '@/actions/store-actions'
import type { StoreAdminInfo } from '@/services/store.service'
import type { SimpleUserInfo } from '@/types/user'
import { formatUserCode } from '@/lib/user-code'

interface StoreAdminsClientProps {
  storeId: string
  storeName: string
  initialAdmins: StoreAdminInfo[]
}

export default function StoreAdminsClient({
  storeId,
  storeName,
  initialAdmins,
}: StoreAdminsClientProps) {
  const router = useRouter()
  const { message, modal } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [admins, setAdmins] = useState<StoreAdminInfo[]>(initialAdmins)
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [newUserId, setNewUserId] = useState('')
  const [users, setUsers] = useState<SimpleUserInfo[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // 加载用户列表
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    setUsers([])
    try {
      const response = await fetch('/api/users?take=100', { cache: 'no-store' })
      const result = await response.json()
      if (result.success && Array.isArray(result.users)) {
        const availableUsers = result.users.map(
          (user: {
            id: string
            code: number
            username: string
            name: string | null
            email: string | null
            avatar: string | null
          }): SimpleUserInfo => ({
            id: user.id,
            code: user.code,
            name: user.name || user.username,
            displayName: user.name || user.username,
            email: user.email || '',
            avatar: user.avatar || undefined,
          })
        )
        setUsers(availableUsers)
      } else {
        message.error('加载用户列表失败')
      }
    } catch (error) {
      console.error('Failed to load users:', error)
      message.error('加载用户列表失败')
    } finally {
      setLoadingUsers(false)
    }
  }, [message])

  useEffect(() => {
    if (addModalVisible) {
      void loadUsers()
    }
  }, [addModalVisible, loadUsers])

  // 返回列表页
  const handleBack = () => {
    router.push('/admin/stores')
  }

  // 删除管理员
  const handleRemoveAdmin = (admin: StoreAdminInfo) => {
    const displayName = admin.user?.displayName || '未知用户'
    modal.confirm({
      title: '确认移除',
      content: `确定要移除管理员 "${displayName}" 吗？`,
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true)
        try {
          const result = await removeStoreAdmin(storeId, admin.userId)
          if (result.success) {
            message.success(result.message)
            // 从列表中移除
            setAdmins(admins.filter((a) => a.id !== admin.id))
          } else {
            message.error(result.message || '移除失败')
          }
        } catch {
          message.error('移除失败，请重试')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  // 添加管理员
  const handleAddAdmin = async () => {
    if (!newUserId.trim()) {
      message.warning('请选择用户')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('userId', newUserId)

      const result = await addStoreAdmin(storeId, formData)
      if (result.success) {
        message.success(result.message)
        // 直接添加到列表中
        if (result.data) {
          setAdmins([...admins, result.data as StoreAdminInfo])
        }
        setNewUserId('')
        setAddModalVisible(false)
      } else {
        message.error(result.message || '添加失败')
      }
    } catch {
      message.error('添加失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 表格列定义
  const columns: ColumnsType<StoreAdminInfo> = [
    {
      title: '管理员',
      dataIndex: 'user',
      key: 'user',
      render: (user) => (
        <Space>
          <Avatar src={user?.avatar} icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 500 }}>{user?.displayName || '未知用户'}</div>
            {user?.email && <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{user.email}</div>}
          </div>
        </Space>
      ),
    },
    {
      title: '用户编码',
      key: 'userCode',
      width: 120,
      render: (_, record) => (record.user ? formatUserCode(record.user.code) : '-'),
    },
    {
      title: '添加时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: Date) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveAdmin(record)}
          disabled={loading}
        >
          移除
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Card variant="borderless">
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          {/* 顶部操作栏 */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
                返回
              </Button>
              <div>
                <Tag icon={<UserOutlined />} color="blue">
                  门店：{storeName}
                </Tag>
                <Tag icon={<UserOutlined />} color="green">
                  管理员：{admins.length} 人
                </Tag>
              </div>
            </Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
              添加管理员
            </Button>
          </div>

          {/* 表格 */}
          <Table
            columns={columns}
            dataSource={admins}
            rowKey="id"
            loading={loading}
            pagination={false}
            locale={{
              emptyText: '暂无管理员，点击右上角"添加管理员"按钮添加',
            }}
          />
        </Space>
      </Card>

      {/* 添加管理员弹窗 */}
      <Modal
        title="添加管理员"
        open={addModalVisible}
        onOk={handleAddAdmin}
        onCancel={() => {
          setAddModalVisible(false)
          setNewUserId('')
        }}
        confirmLoading={loading}
        okText="确定"
        cancelText="取消"
      >
        <div style={{ padding: '20px 0' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>选择用户：</label>
            <Select
              showSearch
              style={{ width: '100%' }}
              placeholder="请选择用户"
              value={newUserId || undefined}
              onChange={(value) => setNewUserId(value)}
              loading={loadingUsers}
              filterOption={(input, option) => {
                const user = users.find((u) => u.id === option?.value)
                if (!user) return false
                const searchText = input.toLowerCase()
                return (
                  user.displayName.toLowerCase().includes(searchText) ||
                  user.name.toLowerCase().includes(searchText) ||
                  user.email.toLowerCase().includes(searchText)
                )
              }}
              notFoundContent={loadingUsers ? <Spin size="small" /> : '暂无用户'}
            >
              {users
                .filter((user) => !admins.some((admin) => admin.userId === user.id))
                .map((user) => (
                  <Select.Option
                    key={user.id}
                    value={user.id}
                    aria-label={`${formatUserCode(user.code)} · ${user.displayName}`}
                  >
                    <Space>
                      <Avatar src={user.avatar} size="small" icon={<UserOutlined />} />
                      <div>
                        <div>
                          {formatUserCode(user.code)} · {user.displayName}
                        </div>
                        {user.email && (
                          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{user.email}</div>
                        )}
                      </div>
                    </Space>
                  </Select.Option>
                ))}
            </Select>
          </div>
          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
            提示：只显示未添加的用户。一个用户可以管理多个门店。
          </div>
        </div>
      </Modal>
    </div>
  )
}
