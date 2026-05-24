'use client'

import { useState } from 'react'
import { Card, Table, Tag, Space, Input, Avatar } from 'antd'
import { SearchOutlined, UserOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import Link from 'next/link'

interface StoreAdminData {
  storeId: string
  storeCode: string
  storeName: string
  isActive: boolean
  admins: Array<{
    userId: string
    displayName: string
    email: string
    avatar?: string
  }>
}

interface StoreAdminsPageClientProps {
  data: StoreAdminData[]
}

export default function StoreAdminsPageClient({
  data,
}: StoreAdminsPageClientProps) {
  const [searchText, setSearchText] = useState('')

  // 过滤数据
  const filteredData = data.filter((item) => {
    const searchLower = searchText.toLowerCase()
    return (
      item.storeName.toLowerCase().includes(searchLower) ||
      item.storeCode.toLowerCase().includes(searchLower) ||
      item.admins.some(
        (admin) =>
          admin.displayName.toLowerCase().includes(searchLower) ||
          admin.email.toLowerCase().includes(searchLower)
      )
    )
  })

  // 表格列定义
  const columns: ColumnsType<StoreAdminData> = [
    {
      title: '门店编码',
      dataIndex: 'storeCode',
      key: 'storeCode',
      width: 120,
    },
    {
      title: '门店名称',
      dataIndex: 'storeName',
      key: 'storeName',
      width: 200,
      render: (name, record) => (
        <Link
          href={`/admin/stores/${record.storeId}/admins`}
          style={{ color: '#1890ff' }}
        >
          {name}
        </Link>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '管理员',
      dataIndex: 'admins',
      key: 'admins',
      render: (admins: StoreAdminData['admins']) => (
        <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          {admins.length === 0 ? (
            <span style={{ color: '#8c8c8c' }}>暂无管理员</span>
          ) : (
            admins.map((admin) => (
              <Space key={admin.userId} size="small">
                <Avatar
                  src={admin.avatar}
                  size="small"
                  icon={<UserOutlined />}
                />
                <div>
                  <span style={{ fontWeight: 500 }}>{admin.displayName}</span>
                  {admin.email && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: '12px',
                        color: '#8c8c8c',
                      }}
                    >
                      ({admin.email})
                    </span>
                  )}
                </div>
              </Space>
            ))
          )}
        </Space>
      ),
    },
    {
      title: '管理员数量',
      dataIndex: 'admins',
      key: 'adminCount',
      width: 100,
      render: (admins: StoreAdminData['admins']) => (
        <Tag color="blue">{admins.length} 人</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Link href={`/admin/stores/${record.storeId}/admins`}>
          <span style={{ color: '#1890ff' }}>管理</span>
        </Link>
      ),
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>门店管理员总览</h2>
      <Card variant="borderless">
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          {/* 搜索栏 */}
          <Input
            placeholder="搜索门店名称、编码或管理员"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 400 }}
          />

          {/* 统计信息 */}
          <div>
            <Space size="large">
              <span>
                总门店数：<strong>{data.length}</strong>
              </span>
              <span>
                有管理员的门店：
                <strong>
                  {data.filter((item) => item.admins.length > 0).length}
                </strong>
              </span>
              <span>
                无管理员的门店：
                <strong>
                  {data.filter((item) => item.admins.length === 0).length}
                </strong>
              </span>
              <span>
                总管理员数：
                <strong>
                  {data.reduce((sum, item) => sum + item.admins.length, 0)}
                </strong>
              </span>
            </Space>
          </div>

          {/* 表格 */}
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="storeId"
            pagination={{
              pageSize: 20,
              showTotal: (total) => `共 ${total} 条记录`,
              showSizeChanger: true,
              showQuickJumper: true,
            }}
          />
        </Space>
      </Card>
    </div>
  )
}
