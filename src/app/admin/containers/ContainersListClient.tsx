'use client'

import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Space,
  Select,
  Switch,
  Tag,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  createContainer,
  updateContainer,
  deleteContainer,
  getNextContainerCode,
  listBindableGoods,
  listContainers,
} from '@/actions/container-actions'
import { CONTAINER_CODE_PATTERN } from '@/lib/container-code-policy'

interface Container {
  id: string
  code: string
  name: string
  unit: string
  deposit: number
  remark?: string | null
  isActive: boolean
  isDeleted: boolean
  goodsBindings: Array<{
    goodsId: string
    goodsCode: string
    goodsName: string
    goodsUnit: string
    goodsQuantityPerContainer: number
  }>
  createdAt: string
  updatedAt: string
}

interface BindableGoods {
  id: string
  code: string
  name: string
  unit: string
}

export default function ContainersListClient() {
  const [loading, setLoading] = useState(false)
  const [containers, setContainers] = useState<Container[]>([])
  const [bindableGoods, setBindableGoods] = useState<BindableGoods[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingContainer, setEditingContainer] = useState<Container | null>(null)
  const [codeLoading, setCodeLoading] = useState(false)
  const [form] = Form.useForm()

  const fetchContainers = async () => {
    setLoading(true)
    try {
      const result = await listContainers()
      if (result.success && result.data) {
        setContainers(result.data as Container[])
      }
    } catch {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchContainers()
    void listBindableGoods().then((result) => {
      if (result.success && result.data) setBindableGoods(result.data)
    })
  }, [])

  const handleCreate = async () => {
    setCodeLoading(true)
    try {
      const result = await getNextContainerCode()
      if (!result.success || !result.data) {
        message.error(result.message || '生成包装物编码失败')
        return
      }

      setEditingContainer(null)
      form.resetFields()
      form.setFieldsValue({ code: result.data, goodsBindings: [] })
      setModalVisible(true)
    } catch {
      message.error('生成包装物编码失败')
    } finally {
      setCodeLoading(false)
    }
  }

  const handleEdit = (container: Container) => {
    setEditingContainer(container)
    form.setFieldsValue({
      ...container,
      remark: container.remark ?? '',
      goodsBindings: container.goodsBindings.map((binding) => ({
        goodsId: binding.goodsId,
        goodsQuantityPerContainer: binding.goodsQuantityPerContainer,
      })),
    })
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个包装物吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await deleteContainer(id)
          if (result.success) {
            message.success('删除成功')
            void fetchContainers()
          } else {
            message.error(result.message || '删除失败')
          }
        } catch {
          message.error('删除失败')
        }
      },
    })
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingContainer) {
        const result = await updateContainer(editingContainer.id, values)
        if (result.success) {
          message.success('更新成功')
          setModalVisible(false)
          void fetchContainers()
        } else {
          message.error(result.message || '更新失败')
        }
      } else {
        const result = await createContainer(values)
        if (result.success) {
          message.success('创建成功')
          setModalVisible(false)
          void fetchContainers()
        } else {
          message.error(result.message || '创建失败')
        }
      }
    } catch {
      message.error('操作失败')
    }
  }

  const columns: ColumnsType<Container> = [
    {
      title: '包装物编码',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
    },
    {
      title: '押金',
      dataIndex: 'deposit',
      key: 'deposit',
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '关联商品',
      dataIndex: 'goodsBindings',
      key: 'goodsBindings',
      width: 260,
      render: (bindings: Container['goodsBindings']) =>
        bindings.length === 0 ? (
          '-'
        ) : (
          <Space size={[0, 4]} wrap>
            {bindings.map((binding) => (
              <Tag key={binding.goodsId}>
                {binding.goodsName} / {binding.goodsQuantityPerContainer} {binding.goodsUnit}
              </Tag>
            ))}
          </Space>
        ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (value: boolean) => (value ? '启用' : '禁用'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_value: unknown, record: Container) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">包装物管理</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          loading={codeLoading}
          onClick={() => void handleCreate()}
        >
          新增包装物
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={containers.filter((c) => !c.isDeleted)}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editingContainer ? '编辑包装物' : '新增包装物'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={760}
        forceRender
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="包装物编码"
            name="code"
            rules={
              editingContainer
                ? []
                : [
                    { required: true, message: '请输入包装物编码' },
                    {
                      pattern: CONTAINER_CODE_PATTERN,
                      message: '包装物编码格式错误，应为 C + 6位数字（如 C000001）',
                    },
                  ]
            }
            tooltip={
              editingContainer
                ? '包装物编码已锁定；历史编码保留原值'
                : '格式：C + 6位数字，如 C000001'
            }
          >
            <Input placeholder="如：C000001" disabled={Boolean(editingContainer)} maxLength={7} />
          </Form.Item>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="请输入名称" />
          </Form.Item>
          <Form.Item label="单位" name="unit" rules={[{ required: true, message: '请输入单位' }]}>
            <Input placeholder="请输入单位，如：个、只" />
          </Form.Item>
          <Form.Item
            label="押金"
            name="deposit"
            rules={[{ required: true, message: '请输入押金' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入押金"
              min={0}
              precision={2}
              suffix="元"
            />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea placeholder="请输入备注" rows={3} />
          </Form.Item>
          <Form.Item label="关联商品" tooltip="同一种包装物可以关联多个商品">
            <Form.List name="goodsBindings">
              {(fields, { add, remove }) => (
                <Space orientation="vertical" style={{ width: '100%' }} size={8}>
                  {fields.map((field) => (
                    <Space key={field.key} align="start" style={{ width: '100%' }}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'goodsId']}
                        rules={[{ required: true, message: '请选择商品' }]}
                        style={{ width: 410, marginBottom: 0 }}
                      >
                        <Select
                          showSearch
                          placeholder="选择商品"
                          optionFilterProp="label"
                          options={bindableGoods.map((goods) => ({
                            value: goods.id,
                            label: `${goods.name} (${goods.code})`,
                          }))}
                        />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'goodsQuantityPerContainer']}
                        rules={[{ required: true, message: '请输入商品数量' }]}
                        style={{ width: 200, marginBottom: 0 }}
                      >
                        <InputNumber
                          min={0.001}
                          precision={3}
                          step={1}
                          style={{ width: '100%' }}
                          placeholder="每个包装物装载数量"
                        />
                      </Form.Item>
                      <Button
                        type="text"
                        danger
                        icon={<MinusCircleOutlined />}
                        aria-label="移除关联商品"
                        onClick={() => remove(field.name)}
                      />
                    </Space>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} block>
                    添加关联商品
                  </Button>
                </Space>
              )}
            </Form.List>
          </Form.Item>
          {editingContainer && (
            <Form.Item label="状态" name="isActive" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
