'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Input, Button, Card, message, Space } from 'antd'
import { createStore, updateStore } from '@/actions/store-actions'

interface StoreFormData {
  code: string
  name: string
  address?: string
  contactName?: string
  contactPhone?: string
}

interface StoreFormClientProps {
  mode: 'create' | 'edit'
  initialValues?: StoreFormData & { id: string }
}

export default function StoreFormClient({
  mode,
  initialValues,
}: StoreFormClientProps) {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  // 表单提交处理
  const handleSubmit = async (values: StoreFormData) => {
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
          ? await createStore(formData)
          : await updateStore(initialValues!.id, formData)

      if (result.success) {
        message.success(result.message)
        router.push('/admin/stores')
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
          label="门店编码"
          name="code"
          rules={[
            { required: true, message: '请输入门店编码' },
            {
              pattern: /^ST\d{4}$/,
              message: '门店编码格式错误，应为 ST + 4位数字（如 ST0001）',
            },
          ]}
          tooltip="格式：ST + 4位数字，如 ST0001"
        >
          <Input
            placeholder="如：ST0001"
            disabled={mode === 'edit'}
            maxLength={6}
          />
        </Form.Item>

        <Form.Item
          label="门店名称"
          name="name"
          rules={[
            { required: true, message: '请输入门店名称' },
            { min: 2, message: '门店名称至少2个字符' },
            { max: 50, message: '门店名称最多50个字符' },
          ]}
        >
          <Input placeholder="请输入门店名称" maxLength={50} />
        </Form.Item>

        <Form.Item label="地址" name="address">
          <Input.TextArea
            placeholder="请输入门店地址"
            rows={3}
            maxLength={200}
            showCount
          />
        </Form.Item>

        <Form.Item
          label="联系人"
          name="contactName"
        >
          <Input placeholder="请输入联系人姓名" maxLength={20} />
        </Form.Item>

        <Form.Item
          label="联系电话"
          name="contactPhone"
          rules={[
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
