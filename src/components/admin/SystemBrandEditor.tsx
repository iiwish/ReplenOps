'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ImageUp, RotateCcw, Save } from 'lucide-react'
import { updateSystemBrand } from '@/actions/system-config-actions'
import { brand, type BrandIdentity } from '@/config/brand'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

const MAX_LOGO_BYTES = 512 * 1024
const ACCEPTED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

interface SystemBrandEditorProps {
  initialConfig: BrandIdentity
}

export default function SystemBrandEditor({ initialConfig }: SystemBrandEditorProps) {
  const router = useRouter()
  const [name, setName] = useState(initialConfig.name)
  const [logoPath, setLogoPath] = useState(initialConfig.logoPath)
  const [savedConfig, setSavedConfig] = useState(initialConfig)
  const [isSaving, setIsSaving] = useState(false)
  const isDirty = name !== savedConfig.name || logoPath !== savedConfig.logoPath
  const logoDescription = useMemo(() => `${name.trim() || '系统'} Logo 预览`, [name])

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!ACCEPTED_LOGO_TYPES.has(file.type)) {
      toast({
        title: 'Logo 格式不支持',
        description: '请选择 PNG、JPG、WEBP 或 GIF 图片。',
        variant: 'destructive',
      })
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast({
        title: 'Logo 文件过大',
        description: 'Logo 文件不能超过 512KB。',
        variant: 'destructive',
      })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setLogoPath(reader.result)
    }
    reader.onerror = () => {
      toast({ title: 'Logo 读取失败', description: '请重新选择图片。', variant: 'destructive' })
    }
    reader.readAsDataURL(file)
  }

  const handleResetLogo = () => setLogoPath(brand.logoPath)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isDirty || !name.trim()) return

    setIsSaving(true)
    const result = await updateSystemBrand({ name, logoPath })
    setIsSaving(false)

    if (!result.success || !result.data) {
      toast({ title: '保存失败', description: result.error, variant: 'destructive' })
      return
    }

    setName(result.data.name)
    setLogoPath(result.data.logoPath)
    setSavedConfig(result.data)
    toast({ title: '系统配置已保存' })
    router.refresh()
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="max-w-3xl">
      <div className="divide-y rounded-md border">
        <div className="grid gap-3 p-4 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
          <label htmlFor="system-name" className="text-sm font-medium">
            系统名称
          </label>
          <div>
            <input
              id="system-name"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="请输入系统名称"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              显示在管理端侧栏和登录页中。
            </p>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start">
          <span className="pt-2 text-sm font-medium">系统 Logo</span>
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border bg-slate-50 p-2">
              <Image
                src={logoPath}
                alt={logoDescription}
                width={64}
                height={64}
                unoptimized
                className="h-16 w-16 object-contain"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap gap-2">
                <label
                  htmlFor="system-logo-upload"
                  className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-accent"
                >
                  <ImageUp className="h-4 w-4" aria-hidden="true" />
                  更换 Logo
                </label>
                <input
                  id="system-logo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={handleLogoChange}
                />
                <Button type="button" variant="ghost" size="sm" onClick={handleResetLogo}>
                  <RotateCcw aria-hidden="true" />
                  使用默认 Logo
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                支持 PNG、JPG、WEBP、GIF，文件大小不超过 512KB。
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        <span className="text-sm text-muted-foreground">
          {isDirty ? '有未保存更改' : '所有更改已保存'}
        </span>
        <Button type="submit" disabled={!isDirty || !name.trim() || isSaving}>
          <Save aria-hidden="true" />
          {isSaving ? '保存中...' : '保存配置'}
        </Button>
      </div>
    </form>
  )
}
