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
  Empty,
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

interface ContainerFormValues {
  code: string
  name: string
  unit: string
  deposit: number
  remark?: string
  isActive?: boolean
  goodsBindings: Array<{
    goodsId: string
    goodsQuantityPerContainer: number
  }>
}

interface ContainerFormState {
  editingContainer: Container | null
  initialValues: ContainerFormValues
}

export default function ContainersListClient({ canManage }: { canManage: boolean }) {
  const [loading, setLoading] = useState(false)
  const [containers, setContainers] = useState<Container[]>([])
  const [bindableGoods, setBindableGoods] = useState<BindableGoods[]>([])
  const [formState, setFormState] = useState<ContainerFormState | null>(null)
  const [codeLoading, setCodeLoading] = useState(false)
  const editingContainer = formState?.editingContainer ?? null

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

      setFormState({
        editingContainer: null,
        initialValues: {
          code: result.data,
          name: '',
          unit: '个',
          deposit: 0,
          goodsBindings: [],
        },
      })
    } catch {
      message.error('生成包装物编码失败')
    } finally {
      setCodeLoading(false)
    }
  }

  const handleEdit = (container: Container) => {
    setFormState({
      editingContainer: container,
      initialValues: {
        code: container.code,
        name: container.name,
        unit: container.unit,
        deposit: container.deposit,
        remark: container.remark ?? '',
        isActive: container.isActive,
        goodsBindings: container.goodsBindings.map((binding) => ({
          goodsId: binding.goodsId,
          goodsQuantityPerContainer: binding.goodsQuantityPerContainer,
        })),
      },
    })
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

  const handleSubmit = async (values: ContainerFormValues) => {
    try {
      if (editingContainer) {
        const result = await updateContainer(editingContainer.id, values)
        if (result.success) {
          message.success('更新成功')
          setFormState(null)
          void fetchContainers()
        } else {
          message.error(result.message || '更新失败')
        }
      } else {
        const result = await createContainer(values)
        if (result.success) {
          message.success('创建成功')
          setFormState(null)
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
      render: (bindings: Container['goodsBindings'], record) =>
        bindings.length === 0 ? (
          '-'
        ) : (
          <Space size={[0, 4]} wrap>
            {bindings.map((binding) => (
              <Tag key={binding.goodsId}>
                {binding.goodsName}：每{record.unit}装 {binding.goodsQuantityPerContainer}{' '}
                {binding.goodsUnit}
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
    ...(canManage
      ? [
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
      : []),
  ]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="m-0 text-lg font-semibold">包装物档案</h2>
          <p className="mb-0 mt-1 text-sm text-gray-500">
            在包装物上维护少量需要随单计算的商品关联。
          </p>
        </div>
        {canManage && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={codeLoading}
            onClick={() => void handleCreate()}
          >
            新增包装物
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={containers.filter((c) => !c.isDeleted)}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={canManage ? '暂无包装物，可先新增包装物' : '暂无包装物'}
            />
          ),
        }}
      />

      <Modal
        title={editingContainer ? '编辑包装物' : '新增包装物'}
        open={Boolean(formState)}
        onCancel={() => setFormState(null)}
        okButtonProps={{ htmlType: 'submit', form: 'container-form' }}
        width={760}
        destroyOnHidden
      >
        {formState && (
          <Form
            key={editingContainer?.id ?? formState.initialValues.code}
            id="container-form"
            layout="vertical"
            initialValues={formState.initialValues}
            onFinish={(values: ContainerFormValues) => void handleSubmit(values)}
          >
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
            <Form.Item
              label="随单商品关联"
              tooltip="从包装物侧维护，普通商品无需配置"
              extra="每条关联都会按“商品订购量 ÷ 每个包装物装载量”自动计算，并同时带入出库单。若包装物为替代关系，请勿重复关联同一商品。"
            >
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
                            placeholder="每个包装物装载的商品数量"
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
        )}
      </Modal>
    </div>
  )
}
