'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Modal, message, Card, Space, Tag } from 'antd'
import { DeleteOutlined, ArrowLeftOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { addStoreAdmin, removeStoreAdmin } from '@/actions/store-actions'
import type { StoreAdminInfo } from '@/services/store.service'

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
  const [loading, setLoading] = useState(false)
  const [admins, setAdmins] = useState<StoreAdminInfo[]>(initialAdmins)
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [newUserId, setNewUserId] = useState('')

  // 返回列表页
  const handleBack = () => {
    router.push('/admin/stores')
  }

  // 删除管理员
  const handleRemoveAdmin = (admin: StoreAdminInfo) => {
    Modal.confirm({
      title: '确认移除',
      content: `确定要移除管理员 "${admin.userId}" 吗？`,
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
        } catch (error) {
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
      message.warning('请输入用户ID')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('userId', newUserId)

      const result = await addStoreAdmin(storeId, formData)
      if (result.success) {
        message.success(result.message)
        if (result.data) {
          setAdmins([...admins, result.data as StoreAdminInfo])
        } else {
          // 如果没有返回数据，刷新页面
          router.refresh()
        }
        setNewUserId('')
        setAddModalVisible(false)
      } else {
        message.error(result.message || '添加失败')
      }
    } catch (error) {
      message.error('添加失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 表格列定义
  const columns: ColumnsType<StoreAdminInfo> = [
    {
      title: '用户ID',
      dataIndex: 'userId',
      key: 'userId',
    },
    {
      title: '添加时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
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
      <Card bordered={false}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
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
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
            >
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
            <label style={{ display: 'block', marginBottom: 8 }}>
              用户ID（Casdoor User ID）：
            </label>
            <input
              type="text"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              placeholder="请输入 Casdoor 用户 ID"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
          </div>
          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
            提示：用户 ID 需要从 Casdoor 用户管理页面获取
          </div>
        </div>
      </Modal>
    </div>
  )
}
