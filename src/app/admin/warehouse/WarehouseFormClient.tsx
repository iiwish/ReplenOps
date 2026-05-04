'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Input, Button, Card, App, Space } from 'antd'
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
  initialValues?: WarehouseFormData & { id: number }
}

export default function WarehouseFormClient({ mode, initialValues }: WarehouseFormClientProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [shouldNavigateTo, setShouldNavigateTo] = useState<string | null>(null)
  const { message } = App.useApp()
  const router = useRouter()

  // 使用 Ant Design Form 的 onFinish 回调
  const handleFinish = async (values: WarehouseFormData) => {
    setLoading(true)
    const formData = new FormData()
    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value))
      }
    })

    const result = await (async () => {
      try {
        return mode === 'create'
          ? await createWarehouse(formData)
          : await updateWarehouse(initialValues!.id, formData)
      } catch (error) {
        console.error('仓库保存请求失败:', error)
        return {
          success: false,
          message: '操作失败，请重试',
        }
      }
    })()

    setLoading(false)

    if (result.success) {
      message.success(result.message)
      setShouldNavigateTo('/admin/warehouse')
      return
    }

    if (result.errors) {
      const fieldErrors = Object.entries(result.errors).map(([field, errors]) => ({
        name: field,
        errors,
      }))
      form.setFields(fieldErrors)
      return
    }

    message.error(result.message || '操作失败')
  }

  // handleSubmit removed - form submission is handled by onFinish directly

  useEffect(() => {
    if (shouldNavigateTo) {
      window.location.href = shouldNavigateTo
    }
  }, [shouldNavigateTo])

  return (
    <Card title={mode === 'create' ? '新增仓库' : '编辑仓库'}>
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={handleFinish}
      >
        <Form.Item
          name="code"
          label="仓库编码"
          rules={[{ required: true, message: '请输入仓库编码' }]}
        >
          <Input placeholder="如：WH0001" />
        </Form.Item>

        <Form.Item
          name="name"
          label="仓库名称"
          rules={[{ required: true, message: '请输入仓库名称' }]}
        >
          <Input placeholder="请输入仓库名称" />
        </Form.Item>

        <Form.Item name="address" label="地址">
          <Input.TextArea placeholder="请输入仓库地址" rows={3} showCount maxLength={200} />
        </Form.Item>

        <Form.Item
          name="contactName"
          label="联系人"
          rules={[{ required: true, message: '请输入联系人' }]}
        >
          <Input placeholder="请输入联系人姓名" />
        </Form.Item>

        <Form.Item
          name="contactPhone"
          label="联系电话"
          rules={[
            { required: true, message: '请输入联系电话' },
            { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' },
          ]}
        >
          <Input placeholder="请输入手机号码" />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              {loading ? '提交中…' : mode === 'create' ? '创建' : '更新'}
            </Button>
            <Button htmlType="button" onClick={() => router.back()}>
              取 消
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  )
}
