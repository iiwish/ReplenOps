import { requireRoles } from '@/lib/rbac-server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, Plus } from 'lucide-react'

export default async function MobileOrderPage() {
  // 验证用户权限，仅允许 store_admin 访问
  await requireRoles(['store_admin'])

  // 示例商品数据
  const products = [
    {
      id: 1,
      name: '商品A',
      price: 99.00,
      stock: 100,
      unit: '件',
    },
    {
      id: 2,
      name: '商品B',
      price: 149.00,
      stock: 50,
      unit: '件',
    },
    {
      id: 3,
      name: '商品C',
      price: 79.00,
      stock: 200,
      unit: '箱',
    },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* 商品列表 - 可滚动区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {products.map((product) => (
          <Card key={product.id} className="touch-feedback">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{product.name}</CardTitle>
                  <CardDescription className="mt-1">
                    库存: {product.stock} {product.unit}
                  </CardDescription>
                </div>
                <Badge variant="secondary">在售</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold text-primary">
                  ¥{product.price.toFixed(2)}
                </div>
                <Button size="sm" className="min-h-[44px]">
                  <Plus className="w-4 h-4 mr-1" />
                  添加
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* 底部间距 */}
        <div className="h-20" />
      </div>

      {/* 底部购物车和提交按钮 - 固定位置 */}
      <div className="sticky bottom-16 left-0 right-0 bg-background border-t p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="text-sm text-muted-foreground">购物车</div>
              <div className="text-lg font-bold">¥0.00</div>
            </div>
          </div>
          <Button size="lg" className="min-h-[48px] px-8">
            提交订单
          </Button>
        </div>
      </div>
    </div>
  )
}
