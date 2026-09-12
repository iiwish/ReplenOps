'use client'

import { useState, useSyncExternalStore } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { brand, type BrandIdentity } from '@/config/brand'
import { safeReturnPath } from '@/lib/wecom/redirect'

const subscribe = () => () => {}
const clientReady = () => true
const serverReady = () => false

export default function LoginForm({
  brandConfig,
  binding = false,
  wecomUrl,
  initialError,
}: {
  brandConfig: BrandIdentity
  binding?: boolean
  wecomUrl?: string
  initialError?: string
}) {
  const [loading, setLoading] = useState(false)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady)
  const disabled = loading || !hydrated

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch(binding ? '/api/auth/wecom/bind' : '/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier,
          password,
        }),
      })

      const data = await response.json()

      if (data.success) {
        const redirectUrl = new URL(window.location.href)
        const redirectParam = redirectUrl.searchParams.get('redirect')
        const safeRedirect = safeReturnPath(binding ? data.redirect : redirectParam)
        window.location.replace(new URL(safeRedirect, window.location.origin).toString())
      } else {
        setError(data.error || '登录失败，请重试')
      }
    } catch {
      setError('网络错误，请检查连接')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1>
            <BrandLogo
              priority
              brandConfig={brandConfig}
              className="justify-center"
              logoClassName="h-12 w-12"
              textClassName="text-3xl font-bold text-gray-900"
            />
          </h1>
          <p className="mt-2 text-sm text-gray-600">{brand.description}</p>
        </div>

        <div className="rounded-lg bg-white p-8 shadow-lg">
          {binding && <h2 className="mb-6 text-lg font-semibold text-gray-900">关联现有账号</h2>}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="identifier" className="mb-2 block text-sm font-medium text-gray-700">
                用户名或手机号
              </label>
              <input
                id="identifier"
                autoComplete="username"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="请输入用户名或手机号"
                required
                disabled={disabled}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">
                密码
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="请输入密码"
                  required
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  title={showPassword ? '隐藏密码' : '显示密码'}
                  disabled={disabled}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 transition-colors hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="mb-4 rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={disabled}
              className="flex w-full items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg
                    className="mr-2 h-5 w-5 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  登录中...
                </>
              ) : binding ? (
                '关联并登录'
              ) : (
                '登录'
              )}
            </button>
          </form>
          {wecomUrl && (
            <a
              href={wecomUrl}
              className="mt-5 block text-center text-sm text-blue-700 hover:underline"
            >
              企业微信登录
            </a>
          )}
          {binding && (
            <a
              href="/api/auth/wecom/cancel"
              className="mt-5 block text-center text-sm text-gray-600 hover:underline"
            >
              取消关联，使用账号登录
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
