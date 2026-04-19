'use client'

import { useState } from 'react'

interface PlatformSwitchProps {
  hasAdmin: boolean
  hasMobile: boolean
  currentPlatform: 'admin' | 'mobile'
}

export default function PlatformSwitch({
  hasAdmin,
  hasMobile,
  currentPlatform,
}: PlatformSwitchProps) {
  const [isSwitching, setIsSwitching] = useState(false)

  // Platform labels and icons
  const platforms = [
    {
      key: 'admin' as const,
      label: '管理端 (PC)',
      sublabel: '仓库 / 库存 / 订单管理',
      href: '/admin',
      active: currentPlatform === 'admin',
      available: hasAdmin,
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      key: 'mobile' as const,
      label: '移动端',
      sublabel: '门店报货 / 包装物',
      href: '/mobile',
      active: currentPlatform === 'mobile',
      available: hasMobile,
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
  ]

  const handleSwitch = async (href: string) => {
    setIsSwitching(true)
    // Set cookie to remember last choice for 30 days
    document.cookie = `erp_platform_preference=${href}; path=/; max-age=${60 * 60 * 24 * 30}`
    // Small delay for visual feedback
    await new Promise((r) => setTimeout(r, 150))
    window.location.href = href
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xl">
      {platforms.map((platform) => {
        if (!platform.available) return null
        return (
          <button
            key={platform.key}
            onClick={() => handleSwitch(platform.href)}
            disabled={isSwitching || platform.active}
            className={`
              flex-1 flex items-center gap-4 p-5 rounded-xl border-2 transition-all duration-200
              ${
                platform.active
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border hover:border-primary/50 hover:shadow-sm bg-card'
              }
              ${isSwitching && !platform.active ? 'opacity-50 pointer-events-none' : ''}
              ${!platform.active ? 'cursor-pointer' : 'cursor-default'}
            `}
          >
            <div className={`${platform.active ? 'text-primary' : 'text-muted-foreground'}`}>
              {platform.icon}
            </div>
            <div className="text-left">
              <div className={`font-semibold ${platform.active ? 'text-primary' : 'text-foreground'}`}>
                {platform.label}
                {platform.active && (
                  <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    当前
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">{platform.sublabel}</div>
            </div>
            {!platform.active && (
              <svg className="w-5 h-5 ml-auto text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}
