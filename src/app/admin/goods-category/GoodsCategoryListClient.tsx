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
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { deleteGoodsCategory, toggleGoodsCategoryStatus } from '@/actions/goods-category-actions'
import type { PaginatedGoodsCategoryResult } from '@/services/goods-category.service'

const { Search } = Input

interface GoodsCategoryListClientProps {
  initialData: PaginatedGoodsCategoryResult
}

type GoodsCategoryRecord = PaginatedGoodsCategoryResult['data'][number]

export default function GoodsCategoryListClient({
  initialData,
}: GoodsCategoryListClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')

  // 搜索处理
  const handleSearch = (value: string) => {
    const params = new URLSearchParams()
    if (value) {
      params.set('keyword', value)
    }
    router.push(`/admin/goods-category?${params.toString()}`)
  }

  // 删除处理
  const handleDelete = (record: GoodsCategoryRecord) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除分类"${record.name}"吗？此操作不可恢复。`,
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true)
        try {
          const result = await deleteGoodsCategory(record.id)
          if (result.success) {
            message.success(result.message)
            router.refresh()
          } else {
            message.error(result.message || '删除失败')
          }
        } catch (error) {
          message.error('删除失败，请重试')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  // 切换状态处理
  const handleToggleStatus = async (record: GoodsCategoryRecord) => {
    setLoading(true)
    try {
      const result = await toggleGoodsCategoryStatus(record.id)
      if (result.success) {
        message.success(result.message)
        router.refresh()
      } else {
        message.error(result.message || '操作失败')
      }
    } catch (error) {
      message.error('操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 表格列定义
  const columns: ColumnsType<GoodsCategoryRecord> = [
    {
      title: '分类编码',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: '分类名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '排序序号',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 100,
      sorter: (a, b) => a.sortOrder - b.sortOrder,
    },
    {
      title: '关联商品数',
      key: 'goodsCount',
      width: 110,
      render: (_, record) => record._count.goods,
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
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => router.push(`/admin/goods-category/${record.id}/edit` as any)}
          >
            编辑
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
              placeholder="搜索分类名称或编码"
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
              onClick={() => router.push('/admin/goods-category/new' as any)}
            >
              新增分类
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
                router.push(`/admin/goods-category?${params.toString()}`)
              },
            }}
            scroll={{ x: 1200 }}
          />
        </Space>
      </Card>
    </div>
  )
}
