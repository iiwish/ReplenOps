'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Input, InputNumber, Button, Card, message, Space } from 'antd'
import { createGoodsCategory, updateGoodsCategory } from '@/actions/goods-category-actions'

interface GoodsCategoryFormData {
  code: string
  name: string
  sortOrder: number
}

interface GoodsCategoryFormClientProps {
  mode: 'create' | 'edit'
  initialValues?: GoodsCategoryFormData & { id: string }
}

export default function GoodsCategoryFormClient({
  mode,
  initialValues,
}: GoodsCategoryFormClientProps) {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [shouldNavigateTo, setShouldNavigateTo] = useState<string | null>(null)

  // 表单提交处理
  const handleSubmit = async (values: GoodsCategoryFormData) => {
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
          ? await createGoodsCategory(formData)
          : await updateGoodsCategory(initialValues!.id, formData)

      if (result.success) {
        message.success(result.message)
        setShouldNavigateTo('/admin/goods-category')
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

  useEffect(() => {
    if (shouldNavigateTo) {
      window.location.href = shouldNavigateTo
    }
  }, [shouldNavigateTo])

  return (
    <Card variant="borderless">
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues || { sortOrder: 0 }}
        onFinish={handleSubmit}
        style={{ maxWidth: 600 }}
      >
        <Form.Item
          label="分类编码"
          name="code"
          rules={[
            { required: true, message: '请输入分类编码' },
            {
              pattern: /^GC\d{4}$/,
              message: '分类编码格式错误，应为 GC + 4位数字（如 GC0001）',
            },
          ]}
          tooltip="格式：GC + 4位数字，如 GC0001"
        >
          <Input
            placeholder="如：GC0001"
            disabled={mode === 'edit'}
            maxLength={6}
          />
        </Form.Item>

        <Form.Item
          label="分类名称"
          name="name"
          rules={[
            { required: true, message: '请输入分类名称' },
            { min: 2, message: '分类名称至少2个字符' },
            { max: 30, message: '分类名称最多30个字符' },
          ]}
        >
          <Input placeholder="请输入分类名称" maxLength={30} />
        </Form.Item>

        <Form.Item
          label="排序序号"
          name="sortOrder"
          rules={[
            { required: true, message: '请输入排序序号' },
            { type: 'number', min: 0, message: '排序序号不能为负数' },
          ]}
          tooltip="数字越小排序越靠前，默认为 0"
        >
          <InputNumber
            placeholder="请输入排序序号"
            min={0}
            style={{ width: '100%' }}
          />
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
