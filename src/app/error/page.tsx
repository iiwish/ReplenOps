import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function ErrorPage({
  searchParams,
}: {
  searchParams: { message?: string }
}) {
  const message = searchParams.message || '发生了一个错误'

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-6 h-6" />
            <CardTitle>出错了</CardTitle>
          </div>
          <CardDescription className="mt-2">
            {decodeURIComponent(message)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>可能的原因：</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>您没有访问此页面的权限</li>
              <li>您的账号角色未正确设置</li>
              <li>会话已过期</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button asChild variant="outline" className="flex-1">
              <Link href="/login">重新登录</Link>
            </Button>
            <Button asChild className="flex-1">
              <Link href="/">返回首页</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
