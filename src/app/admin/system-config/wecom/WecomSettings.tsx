'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { LinkOutlined, SaveOutlined, CheckCircleOutlined, CopyOutlined } from '@ant-design/icons'
import { normalizeAuthOrigin } from '@/lib/wecom/origin'
import ActionTextButton from '@/components/admin/ActionTextButton'
import {
  checkWecomConnection,
  createWecomBinding,
  removeWecomBinding,
  saveWecomSettings,
  searchWecomBindings,
} from '@/actions/wecom-actions'
import type { getWecomAdminConfig, listWecomBindings } from '@/services/wecom-auth.service'

type Config = Awaited<ReturnType<typeof getWecomAdminConfig>>
type Bindings = Awaited<ReturnType<typeof listWecomBindings>>
type SettingsInput = {
  publicOrigin: string
  corpId: string
  agentId: string
  secret?: string
  enabled: boolean
  autoLogin: boolean
}

export default function WecomSettings({
  config,
  initialBindings,
}: {
  config: Config
  initialBindings: Bindings
}) {
  const router = useRouter()
  const [form] = Form.useForm<SettingsInput>()
  const [bindingForm] = Form.useForm<{ username: string; subjectId: string }>()
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<Bindings | null>(null)
  const [notice, contextHolder] = message.useMessage()
  const [modalApi, modalContext] = Modal.useModal()
  const bindings = results ?? initialBindings
  const publicOrigin = Form.useWatch('publicOrigin', form) ?? config.publicOrigin
  let callbackUrl = ''
  try {
    callbackUrl = `${normalizeAuthOrigin(publicOrigin, config.allowLocalHttp)}/api/auth/wecom/callback`
  } catch {
    /* Invalid drafts have no usable callback URL. */
  }

  async function run(
    operation: () => Promise<{ success: boolean; error?: string }>,
    success: string
  ) {
    setBusy(true)
    try {
      const result = await operation()
      if (!result.success) {
        notice.error(result.error ?? '操作失败')
        return false
      }
      notice.success(success)
      router.refresh()
      return true
    } catch {
      notice.error('请求失败，请稍后重试')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function search(value: string, nextPage: number) {
    setBusy(true)
    try {
      setResults(await searchWecomBindings(value, nextPage))
      setQuery(value)
      setPage(nextPage)
    } catch {
      notice.error('读取绑定失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 p-4 sm:p-6">
      {contextHolder}
      {modalContext}
      <section>
        <div className="mb-6 flex flex-wrap items-center gap-3 border-b pb-4">
          <h1 className="text-lg font-semibold">企业微信登录</h1>
          <Tag color={config.enabled ? 'green' : 'default'}>
            {config.enabled ? '已启用' : '未启用'}
          </Tag>
        </div>
        {config.readinessError && (
          <Alert type="warning" showIcon title={config.readinessError} className="mb-5" />
        )}
        <Form
          form={form}
          layout="vertical"
          initialValues={{ ...config, secret: '' }}
          disabled={busy}
          onFinish={async (values) => {
            const ok = await run(
              () =>
                saveWecomSettings({
                  ...values,
                  secret: values.secret ?? '',
                  revision: config.revision,
                }),
              '企业微信配置已保存'
            )
            if (ok)
              form.setFieldsValue({
                secret: '',
                publicOrigin: normalizeAuthOrigin(values.publicOrigin, config.allowLocalHttp),
              })
          }}
        >
          <Form.Item
            name="publicOrigin"
            label="公开登录地址"
            rules={[
              { required: true, message: '请填写公开登录地址' },
              {
                validator: (_, value: string) => {
                  try {
                    normalizeAuthOrigin(value ?? '', config.allowLocalHttp)
                    return Promise.resolve()
                  } catch (error) {
                    return Promise.reject(
                      error instanceof Error ? error : new Error('登录地址无效')
                    )
                  }
                },
              },
            ]}
          >
            <Input maxLength={2048} autoComplete="url" placeholder="https://ops.example.com" />
          </Form.Item>
          <Form.Item label="授权回调地址">
            <Input
              readOnly
              value={callbackUrl}
              aria-label="授权回调地址"
              suffix={
                <Tooltip title="复制回调地址">
                  <Button
                    aria-label="复制回调地址"
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    disabled={!callbackUrl}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(callbackUrl)
                        notice.success('回调地址已复制')
                      } catch {
                        notice.error('复制失败，请手动选择回调地址')
                      }
                    }}
                  />
                </Tooltip>
              }
            />
          </Form.Item>
          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <Form.Item name="corpId" label="企业 ID（CorpID）" rules={[{ required: true }]}>
              <Input maxLength={128} autoComplete="off" />
            </Form.Item>
            <Form.Item
              name="agentId"
              label="应用 AgentId"
              rules={[{ required: true }, { pattern: /^\d+$/, message: '请输入数字' }]}
            >
              <Input maxLength={20} autoComplete="off" />
            </Form.Item>
          </div>
          <Form.Item name="secret" label="应用 Secret">
            <Input.Password
              maxLength={512}
              autoComplete="new-password"
              placeholder={config.hasSecret ? '已配置；留空保留当前密钥' : '未配置'}
            />
          </Form.Item>
          <div className="flex flex-wrap gap-x-12">
            <Form.Item name="enabled" label="启用企业微信登录" valuePropName="checked">
              <Switch aria-label="启用企业微信登录" />
            </Form.Item>
            <Form.Item name="autoLogin" label="企业微信内自动登录" valuePropName="checked">
              <Switch aria-label="企业微信内自动登录" />
            </Form.Item>
          </div>
          <Space wrap>
            <Button
              aria-label="保存配置"
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={busy}
            >
              保存配置
            </Button>
            <Button
              icon={<CheckCircleOutlined />}
              disabled={!config.hasSecret || busy}
              onClick={() =>
                run(checkWecomConnection, '已保存的凭据校验通过；域名和成员访问仍需实际登录验证')
              }
            >
              校验已保存凭据
            </Button>
          </Space>
        </Form>
      </section>
      <section className="border-t pt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">账号绑定</h2>
          <Button
            aria-label="预绑定账号"
            icon={<LinkOutlined />}
            disabled={!config.corpId || busy}
            onClick={() => setModal(true)}
          >
            预绑定账号
          </Button>
        </div>
        <Input.Search
          className="mb-4 max-w-md"
          placeholder="搜索用户名或成员 UserID"
          aria-label="搜索账号绑定"
          allowClear
          onSearch={(value) => search(value, 1)}
          disabled={busy}
          maxLength={128}
        />
        <Table
          size="small"
          rowKey="id"
          loading={busy}
          dataSource={bindings.items}
          scroll={{ x: 700 }}
          pagination={{
            current: page,
            total: bindings.total,
            pageSize: 20,
            showSizeChanger: false,
            onChange: (next) => search(query, next),
          }}
          locale={{ emptyText: '暂无账号绑定' }}
          columns={[
            {
              title: '系统账号',
              key: 'user',
              render: (_, record) => (
                <div>
                  <div>{record.user.username}</div>
                  <div className="text-xs text-gray-500">{record.user.name}</div>
                </div>
              ),
            },
            { title: '企业 ID', dataIndex: 'organizationId' },
            { title: '成员 UserID', dataIndex: 'subjectId' },
            {
              title: '账号状态',
              key: 'status',
              render: (_, record) =>
                record.user.isDeleted ? '已删除' : record.user.isActive ? '正常' : '已禁用',
            },
            {
              title: '操作',
              key: 'actions',
              width: 90,
              render: (_, record) => (
                <ActionTextButton
                  label="解绑"
                  danger
                  disabled={busy}
                  onClick={() =>
                    modalApi.confirm({
                      title: '解除账号绑定？',
                      content: `解除 ${record.user.username} 的企业微信绑定，并使该账号的现有登录会话失效。`,
                      okText: '解除绑定',
                      cancelText: '取消',
                      okButtonProps: { danger: true },
                      onOk: async () => {
                        const ok = await run(() => removeWecomBinding(record.id), '绑定已解除')
                        if (!ok) throw new Error('Unbind failed')
                        setResults(null)
                        setPage(1)
                        setQuery('')
                      },
                    })
                  }
                />
              ),
            },
          ]}
        />
      </section>
      <Modal
        title="预绑定账号"
        open={modal}
        onCancel={() => {
          if (!busy) setModal(false)
        }}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={bindingForm}
          layout="vertical"
          disabled={busy}
          onFinish={async (values) => {
            const ok = await run(() => createWecomBinding(values), '账号已绑定')
            if (ok) {
              setModal(false)
              bindingForm.resetFields()
              setResults(null)
              setPage(1)
              setQuery('')
            }
          }}
        >
          <Form.Item label="企业 ID">
            <Input readOnly value={config.corpId} />
          </Form.Item>
          <Form.Item name="username" label="系统用户名" rules={[{ required: true }]}>
            <Input maxLength={50} autoComplete="off" />
          </Form.Item>
          <Form.Item name="subjectId" label="企业微信成员 UserID" rules={[{ required: true }]}>
            <Input maxLength={128} autoComplete="off" />
          </Form.Item>
          <Button
            aria-label="确认绑定"
            htmlType="submit"
            type="primary"
            icon={<LinkOutlined />}
            loading={busy}
          >
            确认绑定
          </Button>
        </Form>
      </Modal>
    </div>
  )
}
