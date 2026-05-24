'use client'

import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, message, Space } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  createContainer,
  updateContainer,
  deleteContainer,
  listContainers,
} from '@/actions/container-actions'

interface Container {
  id: string
  code: string
  name: string
  unit: string
  deposit: number
  remark?: string | null
  isActive: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export default function ContainersListClient() {
  const [loading, setLoading] = useState(false)
  const [containers, setContainers] = useState<Container[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingContainer, setEditingContainer] = useState<Container | null>(null)
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
    fetchContainers()
  }, [])

  const handleCreate = () => {
    setEditingContainer(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (container: Container) => {
    setEditingContainer(container)
    form.setFieldsValue({
      ...container,
      remark: container.remark ?? '',
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
            fetchContainers()
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
          fetchContainers()
        } else {
          message.error(result.message || '更新失败')
        }
      } else {
        const result = await createContainer(values)
        if (result.success) {
          message.success('创建成功')
          setModalVisible(false)
          fetchContainers()
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
      title: '编号',
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
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
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
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="编号" name="code" rules={[{ required: true, message: '请输入编号' }]}>
            <Input placeholder="请输入编号" />
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
          {editingContainer && (
            <Form.Item label="状态" name="isActive">
              <Space>
                <Button
                  type={form.getFieldValue('isActive') ? 'primary' : 'default'}
                  onClick={() => form.setFieldValue('isActive', true)}
                >
                  启用
                </Button>
                <Button
                  type={!form.getFieldValue('isActive') ? 'primary' : 'default'}
                  onClick={() => form.setFieldValue('isActive', false)}
                >
                  禁用
                </Button>
              </Space>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
