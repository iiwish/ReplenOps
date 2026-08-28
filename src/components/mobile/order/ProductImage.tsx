'use client'

import Image from 'next/image'
import { useState } from 'react'
import { brand } from '@/config/brand'
import { cn } from '@/lib/utils'
import { isRemoteProductImageSource, normalizeProductImageSource } from '@/lib/product-image'

interface ProductImageProps {
  src: string | null | undefined
  alt: string
  className?: string
  sizes: string
}

export function ProductImage({ src, alt, className, sizes }: ProductImageProps) {
  const imageSource = normalizeProductImageSource(src)
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const canRenderImage = imageSource !== null && failedSource !== imageSource

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground',
        className
      )}
    >
      {canRenderImage && imageSource ? (
        <Image
          src={imageSource}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover"
          unoptimized={isRemoteProductImageSource(imageSource)}
          onError={() => setFailedSource(imageSource)}
        />
      ) : (
        <div className="relative h-full w-full" role="img" aria-label={`${alt} 暂无图片`}>
          <Image
            src={brand.productPlaceholderPath}
            alt=""
            fill
            sizes={sizes}
            className="object-cover"
          />
        </div>
      )}
    </div>
  )
}
