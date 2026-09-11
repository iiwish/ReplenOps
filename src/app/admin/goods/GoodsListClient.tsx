'use client'

import { useState } from 'react'
import TableActions from '@/components/admin/TableActions'
import { useRouter } from 'next/navigation'
import { Button, Input, Space, Tag, Modal, message, Select, Empty } from 'antd'
import { PlusOutlined, SearchOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { deleteGoods, getNextGoodsCode, toggleGoodsStatus } from '@/actions/goods-actions'
import type { GoodsStatusFilter, PaginatedGoodsResult } from '@/services/goods.service'
import ActionTextButton from '@/components/admin/ActionTextButton'
import AdminListTable from '@/components/admin/AdminListTable'
import GoodsFormClient from './GoodsFormClient'

const { Search } = Input

interface GoodsListClientProps {
  initialData: PaginatedGoodsResult
  categories: Array<{ id: string; code: string; name: string }>
  canWrite: boolean
  initialSearch?: string
  initialCategoryId?: string
  initialStatus: GoodsStatusFilter
}

type GoodsRecord = PaginatedGoodsResult['data'][number]
type GoodsFormMode = 'create' | 'edit'
const GOODS_FORM_ID = 'goods-record-form'

export default function GoodsListClient({
  initialData,
  categories,
  canWrite,
  initialSearch,
  initialCategoryId,
  initialStatus,
}: GoodsListClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState(initialSearch ?? '')
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(initialCategoryId)
  const [status, setStatus] = useState<GoodsStatusFilter>(initialStatus)
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

  const buildParams = (
    overrides: {
      page?: number
      search?: string
      categoryId?: string
      status?: GoodsStatusFilter
    } = {}
  ) => {
    const nextSearch = 'search' in overrides ? overrides.search : searchKeyword
    const nextCategoryId = 'categoryId' in overrides ? overrides.categoryId : selectedCategory
    const resolvedStatus = 'status' in overrides ? overrides.status : status
    const params = new URLSearchParams()
    if (overrides.page && overrides.page > 1) params.set('page', overrides.page.toString())
    if (nextSearch) params.set('search', nextSearch)
    if (nextCategoryId) params.set('categoryId', nextCategoryId)
    if (resolvedStatus) params.set('status', resolvedStatus)
    return params
  }

  const handleSearch = (value: string) => {
    setSearchKeyword(value)
    const params = buildParams({ search: value })
    router.push(`/admin/goods?${params.toString()}`)
  }

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value || undefined)
    const params = buildParams({ categoryId: value || undefined })
    router.push(`/admin/goods?${params.toString()}`)
  }

  const handleStatusChange = (value: GoodsStatusFilter) => {
    setStatus(value)
    const params = buildParams({ status: value })
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
            width: 160,
            fixed: 'right' as const,
            render: (_: unknown, record: GoodsRecord) => (
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
      : []),
  ]

  return (
    <div className="admin-list-page">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
            <Select<GoodsStatusFilter>
              aria-label="商品状态"
              placeholder="全部状态"
              style={{ width: 140 }}
              value={status}
              onChange={handleStatusChange}
              options={[
                { label: '全部状态', value: 'all' },
                { label: '启用', value: 'active' },
                { label: '禁用', value: 'inactive' },
              ]}
            />
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

        {/* 表格 */}
        <div className="admin-list-table-frame">
          <AdminListTable
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
                const params = buildParams({ page })
                router.push(`/admin/goods?${params.toString()}`)
              },
            }}
            scroll={{ x: 1050 }}
          />
        </div>
      </div>

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
