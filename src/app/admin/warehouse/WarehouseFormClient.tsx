'use client'

import { useState, useEffect } from 'react'
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
  initialValues?: WarehouseFormData & { id: string }
}

export default function WarehouseFormClient({ mode, initialValues }: WarehouseFormClientProps) {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [shouldNavigate, setShouldNavigate] = useState(false)
  const { message } = App.useApp()

  // useEffect 监听导航状态，在 React 渲染周期之外执行导航
  useEffect(() => {
    if (shouldNavigate) {
      window.location.href = '/admin/warehouse'
    }
  }, [shouldNavigate])

  // 使用 Button onClick 处理提交，避免 Ant Design Form 的 Server Action 机制干扰
  const handleSubmit = async () => {
    setLoading(true)

    try {
      // 手动校验表单
      const values = await form.validateFields()

      // 转换为 FormData
      const formData = new FormData()
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value))
        }
      })

      if (mode === 'create') {
        await createWarehouse(formData)
      } else {
        const result = await updateWarehouse(initialValues!.id, formData)
        if (!result.success) {
          if (result.errors) {
            const fieldErrors = Object.entries(result.errors).map(([field, errors]) => ({
              name: field,
              errors,
            }))
            form.setFields(fieldErrors)
          } else {
            message.error(result.message || '更新失败')
          }
          setLoading(false)
          return
        }
        message.success(result.message)
      }

      // 标记需要导航，让 useEffect 处理
      setShouldNavigate(true)
    } catch {
      // 表单校验失败不需要显示错误，Ant Design 会自动显示
      setLoading(false)
    }
  }

  return (
    <Card variant="borderless">
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        style={{ maxWidth: 600 }}
      >
        <Form.Item
          label="仓库编码"
          name="code"
          rules={[
            { required: true, message: '请输入仓库编码' },
            { pattern: /^[A-Z0-9]+$/, message: '编码只能包含大写字母和数字' },
          ]}
        >
          <Input placeholder="如：WH0001" disabled={mode === 'edit'} maxLength={6} />
        </Form.Item>

        <Form.Item
          label="仓库名称"
          name="name"
          rules={[{ required: true, message: '请输入仓库名称' }]}
        >
          <Input placeholder="请输入仓库名称" maxLength={50} />
        </Form.Item>

        <Form.Item label="地址" name="address">
          <Input placeholder="请输入仓库地址" maxLength={200} showCount />
        </Form.Item>

        <Space style={{ display: 'flex' }} size="middle">
          <Form.Item
            label="联系人"
            name="contactName"
            rules={[{ required: true, message: '请输入联系人' }]}
          >
            <Input placeholder="请输入联系人姓名" style={{ width: 200 }} />
          </Form.Item>

          <Form.Item
            label="联系电话"
            name="contactPhone"
            rules={[
              { required: true, message: '请输入联系电话' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码' },
            ]}
          >
            <Input placeholder="请输入手机号码" style={{ width: 200 }} />
          </Form.Item>
        </Space>

        <Form.Item style={{ marginTop: 24 }}>
          <Space>
            <Button type="primary" loading={loading} onClick={handleSubmit}>
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
