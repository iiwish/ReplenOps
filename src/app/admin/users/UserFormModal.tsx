'use client'

import { useState, useEffect } from 'react'
import { Modal, Form, Input, Select, App } from 'antd'
import { createUser, updateUser } from '@/actions/user-actions'
import { ROLE_OPTIONS } from '@/types/user.types'
import type { UserWithRoles } from '@/services/user.service'

interface UserFormModalProps {
  open: boolean
  user: UserWithRoles | null
  onClose: () => void
  onSuccess: () => void
}

interface FormValues {
  username: string
  password: string
  name: string
  email: string
  phone: string
  roles: string[]
}

export function UserFormModal({ open, user, onClose, onSuccess }: UserFormModalProps) {
  const [form] = Form.useForm<FormValues>()
  const [loading, setLoading] = useState(false)
  const { message } = App.useApp()
  const isEdit = !!user

  useEffect(() => {
    if (open) {
      if (user) {
        form.setFieldsValue({
          username: user.username,
          password: '',
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          roles: user.roles || [],
        })
      } else {
        form.resetFields()
        form.setFieldsValue({ roles: ['STORE_ADMIN'] })
      }
    }
  }, [open, user, form])

  const handleSubmit = async (values: FormValues) => {
    setLoading(true)
    try {
      if (isEdit && user) {
        const result = await updateUser(user.id, {
          username: values.username,
          password: values.password || undefined,
          name: values.name,
          email: values.email || undefined,
          phone: values.phone || undefined,
          roles: values.roles,
        })
        if (result.success) {
          message.success(result.message)
          onSuccess()
        } else {
          message.error(result.error || '更新失败')
        }
      } else {
        const result = await createUser({
          username: values.username,
          password: values.password,
          name: values.name,
          email: values.email || undefined,
          phone: values.phone || undefined,
          roles: values.roles,
        })
        if (result.success) {
          message.success(result.message)
          onSuccess()
        } else {
          message.error(result.error || '创建失败')
        }
      }
    } catch {
      message.error(isEdit ? '更新失败，请重试' : '创建失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title={isEdit ? '编辑用户' : '新增用户'}
      open={open}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      destroyOnHidden
      width={500}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
        <Form.Item
          name="username"
          label="登录名"
          rules={[
            { required: true, message: '请输入登录名' },
            { min: 3, message: '登录名至少3个字符' },
            { max: 50, message: '登录名最多50个字符' },
          ]}
        >
          <Input placeholder="请输入登录名" disabled={isEdit} />
        </Form.Item>

        <Form.Item
          name="password"
          label={isEdit ? '新密码（留空则不修改）' : '密码'}
          rules={
            isEdit
              ? [{ min: 6, message: '密码至少6个字符' }]
              : [
                  { required: true, message: '请输入密码' },
                  { min: 6, message: '密码至少6个字符' },
                ]
          }
        >
          <Input.Password placeholder={isEdit ? '留空则不修改密码' : '请输入密码'} />
        </Form.Item>

        <Form.Item
          name="name"
          label="姓名"
          rules={[
            { required: true, message: '请输入姓名' },
            { max: 100, message: '姓名最多100个字符' },
          ]}
        >
          <Input placeholder="请输入姓名" />
        </Form.Item>

        <Form.Item
          name="phone"
          label="手机号"
          rules={[
            {
              pattern: /^$|^1[3-9]\d{9}$/,
              message: '请输入正确的手机号',
            },
          ]}
        >
          <Input placeholder="请输入手机号" />
        </Form.Item>

        <Form.Item
          name="email"
          label="邮箱"
          rules={[{ type: 'email', message: '请输入正确的邮箱地址' }]}
        >
          <Input placeholder="请输入邮箱" />
        </Form.Item>

        <Form.Item name="roles" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
          <Select
            mode="multiple"
            placeholder="请选择角色"
            options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
            allowClear
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
