'use client'

import { useState } from 'react'
import { Input } from 'antd'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search, Package } from 'lucide-react'
import { queryByGoodsCode } from '@/actions/inventory-query-actions'
import { useToast } from '@/hooks/use-toast'
import type { GoodsInventoryResult } from '@/services/inventory-query.service'

export default function InventoryScanClient() {
  const [goodsCode, setGoodsCode] = useState('')
  const [result, setResult] = useState<GoodsInventoryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSearch = async () => {
    if (!goodsCode.trim()) {
      toast({
        variant: 'destructive',
        title: '请输入商品编码',
      })
      return
    }

    setLoading(true)
    try {
      const res = await queryByGoodsCode({ code: goodsCode.trim() })
      if (res.success) {
        setResult((res.data as GoodsInventoryResult) ?? null)
      } else {
        toast({
          variant: 'destructive',
          title: res.message || '查询失败',
        })
      }
    } catch {
      toast({
        variant: 'destructive',
        title: '查询出错，请重试',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="输入商品编码"
            value={goodsCode}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoodsCode(e.target.value)}
            onPressEnter={handleSearch}
            disabled={loading}
            addonAfter={
              <Button onClick={handleSearch} disabled={loading} size="sm">
                <Search className="mr-1 h-4 w-4" />
                查询
              </Button>
            }
          />
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {result.goods.imageUrl && (
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-gray-100">
                    <img
                      src={result.goods.imageUrl}
                      alt={result.goods.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold">{result.goods.name}</h3>
                  {result.goods.spec && (
                    <p className="text-sm text-muted-foreground">{result.goods.spec}</p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">编码：{result.goods.code}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h4 className="flex items-center gap-2 font-medium">
              <Package className="h-4 w-4" />
              各仓库库存
            </h4>

            {result.inventories.map((inv) => (
              <Card key={inv.warehouseId}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium">{inv.warehouseName}</h5>
                      <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                        <span>总库存：{inv.quantity}</span>
                        <span>锁定：{inv.lockedQuantity}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">{inv.availableQuantity}</div>
                      <div className="text-xs text-muted-foreground">可用</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {result.inventories.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  暂无库存信息
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
