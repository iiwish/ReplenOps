'use client'

import { useState } from 'react'
import { changeCurrentUserPassword } from '@/actions/user-actions'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'

interface PasswordFields {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

const EMPTY_FIELDS: PasswordFields = {
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
}

type PasswordField = keyof PasswordFields

export default function ChangePasswordForm() {
  const [fields, setFields] = useState<PasswordFields>(EMPTY_FIELDS)
  const [visibleFields, setVisibleFields] = useState<Record<PasswordField, boolean>>({
    oldPassword: false,
    newPassword: false,
    confirmPassword: false,
  })
  const [expanded, setExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const updateField = (field: keyof PasswordFields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }))
  }

  const toggleVisibility = (field: PasswordField) => {
    setVisibleFields((current) => ({ ...current, [field]: !current[field] }))
  }

  const resetForm = () => {
    setFields(EMPTY_FIELDS)
    setVisibleFields({ oldPassword: false, newPassword: false, confirmPassword: false })
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (fields.newPassword !== fields.confirmPassword) {
      toast({
        title: '密码修改失败',
        description: '两次输入的新密码不一致',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)

    try {
      const result = await changeCurrentUserPassword(fields)

      if (!result.success) {
        toast({
          title: '密码修改失败',
          description: result.error || '请检查输入后重试',
          variant: 'destructive',
        })
        return
      }

      resetForm()
      setExpanded(false)
      toast({ title: '密码修改成功', description: '下次登录请使用新密码' })
    } catch (error) {
      toast({
        title: '密码修改失败',
        description: error instanceof Error ? error.message : '网络错误，请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between"
        onClick={() => setExpanded(true)}
        aria-expanded={false}
        aria-controls="mobile-change-password-form"
      >
        <span>修改密码</span>
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </Button>
    )
  }

  return (
    <form id="mobile-change-password-form" onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="mobile-old-password" className="mb-1 block text-sm font-medium">
          当前密码
        </label>
        <div className="relative">
          <input
            id="mobile-old-password"
            type={visibleFields.oldPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={fields.oldPassword}
            onChange={(event) => updateField('oldPassword', event.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 pr-12 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="请输入当前密码"
            required
            disabled={submitting}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 h-8 w-8 text-muted-foreground"
            onClick={() => toggleVisibility('oldPassword')}
            aria-label={visibleFields.oldPassword ? '隐藏当前密码' : '显示当前密码'}
            title={visibleFields.oldPassword ? '隐藏密码' : '显示密码'}
            disabled={submitting}
          >
            {visibleFields.oldPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </div>

      <div>
        <label htmlFor="mobile-new-password" className="mb-1 block text-sm font-medium">
          新密码
        </label>
        <div className="relative">
          <input
            id="mobile-new-password"
            type={visibleFields.newPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={fields.newPassword}
            onChange={(event) => updateField('newPassword', event.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 pr-12 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="至少6个字符"
            minLength={6}
            maxLength={100}
            required
            disabled={submitting}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 h-8 w-8 text-muted-foreground"
            onClick={() => toggleVisibility('newPassword')}
            aria-label={visibleFields.newPassword ? '隐藏新密码' : '显示新密码'}
            title={visibleFields.newPassword ? '隐藏密码' : '显示密码'}
            disabled={submitting}
          >
            {visibleFields.newPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </div>

      <div>
        <label htmlFor="mobile-confirm-password" className="mb-1 block text-sm font-medium">
          确认新密码
        </label>
        <div className="relative">
          <input
            id="mobile-confirm-password"
            type={visibleFields.confirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={fields.confirmPassword}
            onChange={(event) => updateField('confirmPassword', event.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 pr-12 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="请再次输入新密码"
            minLength={6}
            maxLength={100}
            required
            disabled={submitting}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 h-8 w-8 text-muted-foreground"
            onClick={() => toggleVisibility('confirmPassword')}
            aria-label={visibleFields.confirmPassword ? '隐藏确认密码' : '显示确认密码'}
            title={visibleFields.confirmPassword ? '隐藏密码' : '显示密码'}
            disabled={submitting}
          >
            {visibleFields.confirmPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          className="h-10 shrink-0 px-3 text-muted-foreground"
          onClick={() => {
            resetForm()
            setExpanded(false)
          }}
          disabled={submitting}
          aria-expanded={true}
          aria-controls="mobile-change-password-form"
        >
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
          收起
        </Button>
        <Button type="submit" className="h-10 min-w-0 flex-1" disabled={submitting}>
          {submitting ? '提交中...' : '确认修改'}
        </Button>
      </div>
    </form>
  )
}
