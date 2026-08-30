'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Input, Space, Tag, Modal, message, Select, Empty } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { deleteGoods, getNextGoodsCode, toggleGoodsStatus } from '@/actions/goods-actions'
import type { PaginatedGoodsResult } from '@/services/goods.service'
import GoodsFormClient from './GoodsFormClient'

const { Search } = Input

interface GoodsListClientProps {
  initialData: PaginatedGoodsResult
  categories: Array<{ id: string; code: string; name: string }>
  canWrite: boolean
}

type GoodsRecord = PaginatedGoodsResult['data'][number]
type GoodsFormMode = 'create' | 'edit'
const GOODS_FORM_ID = 'goods-record-form'

export default function GoodsListClient({
  initialData,
  categories,
  canWrite,
}: GoodsListClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>()
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [formMode, setFormMode] = useState<GoodsFormMode>('create')
  const [editingGoods, setEditingGoods] = useState<GoodsRecord | null>(null)
  const [nextGoodsCode, setNextGoodsCode] = useState<string>()
  const [codeLoading, setCodeLoading] = useState(false)
  const [formSubmitting, setFormSubmitting] = useState(false)

  const handleOpenCreateModal = async () => {
    setCodeLoading(true)
    try {
      const result = await getNextGoodsCode()
      if (!result.success || !result.data) {
        message.error(result.message || '生成商品编码失败')
        return
      }

      setFormMode('create')
      setEditingGoods(null)
      setNextGoodsCode(result.data)
      setFormSubmitting(false)
      setFormModalOpen(true)
    } catch {
      message.error('生成商品编码失败')
    } finally {
      setCodeLoading(false)
    }
  }

  const handleOpenEditModal = (record: GoodsRecord) => {
    setFormMode('edit')
    setEditingGoods(record)
    setFormSubmitting(false)
    setFormModalOpen(true)
  }

  const handleCloseFormModal = () => {
    if (formSubmitting) return
    setFormModalOpen(false)
    setEditingGoods(null)
  }

  const handleFormSuccess = () => {
    setFormSubmitting(false)
    setFormModalOpen(false)
    setEditingGoods(null)
    router.refresh()
  }

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
        } catch {
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
    } catch {
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
      title: '分类 / 规格',
      key: 'categoryAndSpec',
      width: 170,
      render: (_, record) => (
        <div>
          <div>{record.categoryName}</div>
          <div className="text-xs text-gray-500">{record.spec || '未设置规格'}</div>
        </div>
      ),
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
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
      title: '领用价',
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
    ...(canWrite
      ? [
          {
            title: '操作',
            key: 'action',
            width: 200,
            fixed: 'right' as const,
            render: (_: unknown, record: GoodsRecord) => (
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
      : []),
  ]

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl font-semibold">商品档案</h1>
          <p className="mb-0 mt-1 text-sm text-gray-500">查询商品、价格与启用状态。</p>
        </div>
        {canWrite && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={codeLoading}
            onClick={() => void handleOpenCreateModal()}
          >
            新增商品
          </Button>
        )}
      </div>

      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <div className="flex flex-wrap gap-2">
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
        </div>

        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={initialData.data}
          rowKey="id"
          loading={loading}
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的商品" />
            ),
          }}
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
          scroll={{ x: 1050 }}
        />
      </Space>

      {canWrite && (
        <Modal
          title={formMode === 'create' ? '新增商品' : '编辑商品'}
          open={formModalOpen}
          onCancel={handleCloseFormModal}
          footer={
            <Space>
              <Button onClick={handleCloseFormModal} disabled={formSubmitting}>
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                form={GOODS_FORM_ID}
                loading={formSubmitting}
              >
                {formMode === 'create' ? '创建' : '保存'}
              </Button>
            </Space>
          }
          width={900}
          destroyOnHidden
          maskClosable={!formSubmitting}
          keyboard={!formSubmitting}
          styles={{ body: { maxHeight: 'calc(100dvh - 220px)', overflowY: 'auto' } }}
        >
          {formModalOpen && (
            <GoodsFormClient
              mode={formMode}
              formId={GOODS_FORM_ID}
              initialCode={formMode === 'create' ? nextGoodsCode : undefined}
              initialValues={
                editingGoods
                  ? {
                      id: editingGoods.id,
                      code: editingGoods.code,
                      name: editingGoods.name,
                      categoryId: editingGoods.categoryId,
                      spec: editingGoods.spec || undefined,
                      unit: editingGoods.unit,
                      measureType: editingGoods.measureType,
                      costPrice: editingGoods.costPrice,
                      partnerPrice: editingGoods.partnerPrice,
                      defaultInPrice: editingGoods.defaultInPrice,
                      imageUrl: editingGoods.imageUrl || undefined,
                      description: editingGoods.description || undefined,
                    }
                  : undefined
              }
              categories={categories}
              onSuccess={handleFormSuccess}
              onSubmittingChange={setFormSubmitting}
            />
          )}
        </Modal>
      )}
    </div>
  )
}
