'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Input, Button, Card, message, Space } from 'antd'
import { createWarehouse, updateWarehouse } from '@/actions/warehouse-actions'

interface WarehouseFormData {
  code: string
  name: string
  address?: string
  contactName: string
  contactPhone: string
}

interface WarehouseFormClientProps {
  mode: 'create' | 'edit'
  initialValues?: WarehouseFormData & { id: string }
}

export default function WarehouseFormClient({
  mode,
  initialValues,
}: WarehouseFormClientProps) {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  // 表单提交处理
  const handleSubmit = async (values: WarehouseFormData) => {
    setLoading(true)

    try {
      // 将表单数据转换为 FormData
      const formData = new FormData()
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value.toString())
        }
      })

      // 调用对应的 Server Action
      const result =
        mode === 'create'
          ? await createWarehouse(formData)
          : await updateWarehouse(initialValues!.id, formData)

      if (result.success) {
        message.success(result.message)
        router.push('/admin/warehouse')
        router.refresh()
      } else {
        // 处理验证错误
        if (result.errors) {
          const fieldErrors = Object.entries(result.errors).map(
            ([field, errors]) => ({
              name: field,
              errors,
            })
          )
          form.setFields(fieldErrors)
        } else {
          message.error(result.message || '操作失败')
        }
      }
    } catch (error) {
      message.error('操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card bordered={false}>
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={handleSubmit}
        style={{ maxWidth: 600 }}
      >
        <Form.Item
          label="仓库编码"
          name="code"
          rules={[
            { required: true, message: '请输入仓库编码' },
            {
              pattern: /^WH\d{4}$/,
              message: '仓库编码格式错误，应为 WH + 4位数字（如 WH0001）',
            },
          ]}
          tooltip="格式：WH + 4位数字，如 WH0001"
        >
          <Input
            placeholder="如：WH0001"
            disabled={mode === 'edit'}
            maxLength={6}
          />
        </Form.Item>

        <Form.Item
          label="仓库名称"
          name="name"
          rules={[{ required: true, message: '请输入仓库名称' }]}
        >
          <Input placeholder="请输入仓库名称" maxLength={50} />
        </Form.Item>

        <Form.Item label="地址" name="address">
          <Input.TextArea
            placeholder="请输入仓库地址"
            rows={3}
            maxLength={200}
            showCount
          />
        </Form.Item>

        <Form.Item
          label="联系人"
          name="contactName"
          rules={[{ required: true, message: '请输入联系人' }]}
        >
          <Input placeholder="请输入联系人姓名" maxLength={20} />
        </Form.Item>

        <Form.Item
          label="联系电话"
          name="contactPhone"
          rules={[
            { required: true, message: '请输入联系电话' },
            {
              pattern: /^1[3-9]\d{9}$/,
              message: '请输入正确的手机号码',
            },
          ]}
        >
          <Input placeholder="请输入手机号码" maxLength={11} />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              {mode === 'create' ? '创建' : '保存'}
            </Button>
            <Button onClick={() => router.back()} disabled={loading}>
              取消
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  )
}
