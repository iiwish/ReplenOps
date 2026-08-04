'use client'

import { ImageOff } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ProductImageProps {
  src: string | null | undefined
  alt: string
  className?: string
  sizes: string
}

function normalizeImageUrl(source: string | null | undefined): string | null {
  const trimmedSource = source?.trim()

  if (!trimmedSource) {
    return null
  }

  return trimmedSource.replace(/(\.(?:avif|gif|jpe?g|png|webp))_\d+x\d+(?=$|\?)/i, '$1')
}

export function ProductImage({ src, alt, className, sizes }: ProductImageProps) {
  const imageSource = normalizeImageUrl(src)
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
          onError={() => setFailedSource(imageSource)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center" role="img" aria-label={`${alt} 暂无图片`}>
          <ImageOff className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}
