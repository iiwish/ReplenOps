import Image from 'next/image'
import { brand } from '@/config/brand'
import { cn } from '@/lib/utils'

interface BrandLogoProps {
  compact?: boolean
  className?: string
  logoClassName?: string
  textClassName?: string
  priority?: boolean
}

export function BrandLogo({
  compact = false,
  className,
  logoClassName,
  textClassName,
  priority = false,
}: BrandLogoProps) {
  return (
    <span
      className={cn('flex min-w-0 items-center gap-2.5', className)}
      role={compact ? 'img' : undefined}
      aria-label={compact ? brand.name : undefined}
    >
      <Image
        src={brand.logoPath}
        alt=""
        width={512}
        height={512}
        priority={priority}
        className={cn('h-9 w-9 shrink-0', logoClassName)}
      />
      {!compact && (
        <span className={cn('truncate text-lg font-semibold', textClassName)}>{brand.name}</span>
      )}
    </span>
  )
}
