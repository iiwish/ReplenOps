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
  Select,
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
import { deleteGoods, toggleGoodsStatus } from '@/actions/goods-actions'
import type { PaginatedGoodsResult } from '@/services/goods.service'

const { Search } = Input

interface GoodsListClientProps {
  initialData: PaginatedGoodsResult
  categories: Array<{ id: string; code: string; name: string }>
}

type GoodsRecord = PaginatedGoodsResult['data'][number]

export default function GoodsListClient({
  initialData,
  categories,
}: GoodsListClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>()

  // 搜索处理
  const handleSearch = (value: string) => {
    const params = new URLSearchParams()
    if (value) {
      params.set('search', value)
    }
    if (selectedCategory) {
      params.set('categoryId', selectedCategory)
    }
    router.push(`/admin/goods?${params.toString()}`)
  }

  // 分类筛选处理
  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value)
    const params = new URLSearchParams()
    if (value) {
      params.set('categoryId', value)
    }
    if (searchKeyword) {
      params.set('search', searchKeyword)
    }
    router.push(`/admin/goods?${params.toString()}`)
  }

  // 删除处理
  const handleDelete = (record: GoodsRecord) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除商品"${record.name}"吗？此操作不可恢复。`,
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true)
        try {
          const result = await deleteGoods(record.id)
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
  const handleToggleStatus = async (record: GoodsRecord) => {
    setLoading(true)
    try {
      const result = await toggleGoodsStatus(record.id)
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
  const columns: ColumnsType<GoodsRecord> = [
    {
      title: '商品编码',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      fixed: 'left',
    },
    {
      title: '商品名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      fixed: 'left',
    },
    {
      title: '分类',
      dataIndex: 'categoryName',
      key: 'categoryName',
      width: 120,
    },
    {
      title: '规格',
      dataIndex: 'spec',
      key: 'spec',
      width: 100,
      render: (spec: string | null) => spec || '-',
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
    },
    {
      title: '计量类型',
      dataIndex: 'measureType',
      key: 'measureType',
      width: 100,
      render: (measureType: 'INT' | 'DECIMAL') =>
        measureType === 'INT' ? (
          <Tag color="blue">整数</Tag>
        ) : (
          <Tag color="green">小数</Tag>
        ),
    },
    {
      title: '成本价',
      dataIndex: 'costPrice',
      key: 'costPrice',
      width: 100,
      align: 'right',
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
    {
      title: '合作价',
      dataIndex: 'partnerPrice',
      key: 'partnerPrice',
      width: 100,
      align: 'right',
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
    {
      title: '默认入库价',
      dataIndex: 'defaultInPrice',
      key: 'defaultInPrice',
      width: 120,
      align: 'right',
      render: (price: number) => `¥${price.toFixed(2)}`,
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
            onClick={() => router.push(`/admin/goods/${record.id}/edit` as any)}
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
            <Space>
              <Select
                placeholder="请选择分类"
                allowClear
                style={{ width: 200 }}
                value={selectedCategory}
                onChange={handleCategoryChange}
                options={[
                  { label: '全部分类', value: '' },
                  ...categories.map((cat) => ({
                    label: cat.name,
                    value: cat.id,
                  })),
                ]}
              />
              <Search
                placeholder="搜索商品名称或编码"
                allowClear
                enterButton={<SearchOutlined />}
                style={{ width: 300 }}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onSearch={handleSearch}
              />
            </Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => router.push('/admin/goods/new' as any)}
            >
              新增商品
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
                if (searchKeyword) {
                  params.set('search', searchKeyword)
                }
                if (selectedCategory) {
                  params.set('categoryId', selectedCategory)
                }
                router.push(`/admin/goods?${params.toString()}`)
              },
            }}
            scroll={{ x: 1500 }}
          />
        </Space>
      </Card>
    </div>
  )
}
