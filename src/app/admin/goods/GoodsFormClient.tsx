'use client'

import { useState, useEffect } from 'react'
import {
  Form,
  Input,
  InputNumber,
  Button,
  message,
  Space,
  Select,
  Radio,
} from 'antd'
import { createGoods, updateGoods } from '@/actions/goods-actions'
import { listContainers } from '@/actions/container-actions'

const { TextArea } = Input

export interface GoodsFormData {
  code: string
  name: string
  categoryId: string
  spec?: string
  unit: string
  measureType: 'INT' | 'DECIMAL'
  costPrice: number
  partnerPrice: number
  defaultInPrice: number
  containerId?: string | null
  containerRatio?: number
  imageUrl?: string
  description?: string
}

interface ContainerOption {
  id: string
  code: string
  name: string
  unit: string
}

interface GoodsFormClientProps {
  mode: 'create' | 'edit'
  initialValues?: GoodsFormData & { id: string }
  categories: Array<{ id: string; code: string; name: string }>
  onCancel: () => void
  onSuccess: () => void
}

export default function GoodsFormClient({
  mode,
  initialValues,
  categories,
  onCancel,
  onSuccess,
}: GoodsFormClientProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [containers, setContainers] = useState<ContainerOption[]>([])

  // 表单提交处理
  const handleSubmit = async (values: GoodsFormData) => {
    setLoading(true)

    try {
      // 将表单数据转换为 FormData
      const formData = new FormData()
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          formData.append(key, value.toString())
        }
      })

      // 调用对应的 Server Action
      const result =
        mode === 'create'
          ? await createGoods(formData)
          : await updateGoods(initialValues!.id, formData)

      if (result.success) {
        message.success(result.message)
        onSuccess()
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
    } catch {
      message.error('操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadContainers = async () => {
      const result = await listContainers()
      if (result.success && Array.isArray(result.data)) {
        setContainers(result.data.map((container) => ({
          id: container.id,
          code: container.code,
          name: container.name,
          unit: container.unit,
        })))
      }
    }

    void loadContainers()
  }, [])

  return (
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues || { measureType: 'INT' }}
        onFinish={handleSubmit}
        style={{ maxWidth: 800 }}
      >
        <Form.Item
          label="商品编码"
          name="code"
          rules={[
            { required: true, message: '请输入商品编码' },
            {
              pattern: /^G\d{6}$/,
              message: '商品编码格式错误，应为 G + 6位数字（如 G000001）',
            },
          ]}
          tooltip="格式：G + 6位数字，如 G000001"
        >
          <Input
            placeholder="如：G000001"
            disabled={mode === 'edit'}
            maxLength={7}
          />
        </Form.Item>

        <Form.Item
          label="商品名称"
          name="name"
          rules={[
            { required: true, message: '请输入商品名称' },
            { min: 2, message: '商品名称至少2个字符' },
            { max: 50, message: '商品名称最多50个字符' },
          ]}
        >
          <Input placeholder="请输入商品名称" maxLength={50} />
        </Form.Item>

        <Form.Item
          label="商品分类"
          name="categoryId"
          rules={[{ required: true, message: '请选择商品分类' }]}
        >
          <Select
            placeholder="请选择商品分类"
            options={categories.map((cat) => ({
              label: `${cat.name} (${cat.code})`,
              value: cat.id,
            }))}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <Space style={{ width: '100%' }} size="large">
          <Form.Item
            label="规格"
            name="spec"
            style={{ width: 250 }}
            tooltip="如：500g、1kg、500ml"
          >
            <Input placeholder="如：500g" />
          </Form.Item>

          <Form.Item
            label="单位"
            name="unit"
            rules={[
              { required: true, message: '请输入单位' },
              { min: 1, message: '单位至少1个字符' },
              { max: 10, message: '单位最多10个字符' },
            ]}
            style={{ width: 150 }}
          >
            <Input placeholder="如：瓶、kg、箱" maxLength={10} />
          </Form.Item>
        </Space>

        <Space style={{ width: '100%' }} size="large" align="start">
          <Form.Item
            label="绑定包装物"
            name="containerId"
            style={{ width: 250 }}
            tooltip="出库完成后，会按商品数量和配比自动借出包装物"
          >
            <Select
              allowClear
              placeholder="不绑定包装物"
              options={containers.map((container) => ({
                label: `${container.name} (${container.code})`,
                value: container.id,
              }))}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item
            label="包装物配比"
            name="containerRatio"
            style={{ width: 180 }}
            dependencies={["containerId"]}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value: number | undefined) {
                  if (!getFieldValue('containerId') || (value && value > 0)) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('绑定包装物时请输入配比'))
                },
              }),
            ]}
            tooltip="每多少个商品需要 1 个包装物，例如 30 个鸡蛋/框则填 30"
          >
            <InputNumber
              placeholder="如：30"
              min={0}
              precision={0}
              step={1}
              style={{ width: 180 }}
            />
          </Form.Item>
        </Space>

        <Form.Item
          label="计量类型"
          name="measureType"
          rules={[{ required: true, message: '请选择计量类型' }]}
          tooltip="整数：库存、订单数量只能输入整数；小数：可输入小数（精度0.001）"
        >
          <Radio.Group>
            <Radio value="INT">整数（如：1, 2, 3...）</Radio>
            <Radio value="DECIMAL">小数（如：1.5, 2.35...）</Radio>
          </Radio.Group>
        </Form.Item>

        <Space style={{ width: '100%' }} size="large">
          <Form.Item
            label="成本价（元）"
            name="costPrice"
            rules={[
              { required: true, message: '请输入成本价' },
              { type: 'number', min: 0, message: '成本价不能为负数' },
            ]}
            tooltip="采购价格"
          >
            <InputNumber
              placeholder="0.00"
              min={0}
              precision={2}
              step={0.01}
              style={{ width: 150 }}
            />
          </Form.Item>

          <Form.Item
            label="领用价（元）"
            name="partnerPrice"
            rules={[
              { required: true, message: '请输入领用价' },
              { type: 'number', min: 0, message: '领用价不能为负数' },
            ]}
            tooltip="内部领用计价"
          >
            <InputNumber
              placeholder="0.00"
              min={0}
              precision={2}
              step={0.01}
              style={{ width: 150 }}
            />
          </Form.Item>

          <Form.Item
            label="默认入库价（元）"
            name="defaultInPrice"
            rules={[
              { required: true, message: '请输入默认入库价' },
              { type: 'number', min: 0, message: '默认入库价不能为负数' },
            ]}
            tooltip="一般等于成本价"
          >
            <InputNumber
              placeholder="0.00"
              min={0}
              precision={2}
              step={0.01}
              style={{ width: 150 }}
            />
          </Form.Item>
        </Space>

        <Form.Item
          label="图片URL"
          name="imageUrl"
          rules={[
            { type: 'url', message: '请输入有效的URL' },
          ]}
          tooltip="商品图片链接（可选）"
        >
          <Input placeholder="https://example.com/image.jpg" />
        </Form.Item>

        <Form.Item
          label="商品描述"
          name="description"
          tooltip="商品详细描述（可选）"
        >
          <TextArea
            placeholder="请输入商品描述"
            rows={4}
            maxLength={500}
            showCount
          />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              {mode === 'create' ? '创建' : '保存'}
            </Button>
            <Button onClick={onCancel} disabled={loading}>
              取消
            </Button>
          </Space>
        </Form.Item>
      </Form>
  )
}
