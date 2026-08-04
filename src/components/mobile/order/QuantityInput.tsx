'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Minus, Plus } from 'lucide-react'

interface QuantityInputProps {
  value: number
  measureType: 'INT' | 'DECIMAL'
  max: number
  min?: number
  onChange: (value: number) => void
  size?: 'sm' | 'md' | 'lg'
}

export function QuantityInput({
  value,
  measureType,
  max,
  min = 0,
  onChange,
  size = 'md',
}: QuantityInputProps) {
  const [inputValue, setInputValue] = useState(value.toString())
  const [isEditing, setIsEditing] = useState(false)

  const step = 1
  const minValue = Math.max(1, min)

  const handleDecrease = () => {
    const newValue = Math.max(minValue, value - step)
    const roundedValue = parseFloat(newValue.toFixed(3))
    onChange(roundedValue)
  }

  const handleIncrease = () => {
    const newValue = Math.min(max, value + step)
    const roundedValue = parseFloat(newValue.toFixed(3))
    onChange(roundedValue)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleInputBlur = () => {
    setIsEditing(false)
    let newValue = parseFloat(inputValue)

    // 验证输入
    if (isNaN(newValue)) {
      setInputValue(value.toString())
      return
    }

    // 限制范围
    newValue = Math.max(minValue, Math.min(max, newValue))

    // 整数类型取整
    if (measureType === 'INT') {
      newValue = Math.round(newValue)
    } else {
      // 小数类型保留3位
      newValue = parseFloat(newValue.toFixed(3))
    }

    onChange(newValue)
    setInputValue(newValue.toString())
  }

  const handleInputFocus = () => {
    setIsEditing(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }

  const canDecrease = value > minValue
  const canIncrease = value < max
  const displayValue = isEditing ? inputValue : value.toString()

  // 紧凑尺寸用于商品卡片，保留常规尺寸供购物车和确认页使用
  const buttonSize =
    size === 'sm'
      ? 'h-7 w-7 min-h-0 min-w-0'
      : size === 'lg'
        ? 'h-10 w-10 min-h-[52px] min-w-[52px]'
        : 'h-8 w-8 min-h-[44px] min-w-[44px]'
  const textSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base'
  const inputWidth = size === 'sm' ? 'w-8 min-w-0' : size === 'lg' ? 'w-16 min-w-0' : 'w-12 min-w-0'
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'

  return (
    <div className={`flex items-center ${size === 'sm' ? 'gap-1' : 'gap-2'}`}>
      <Button
        size="icon"
        variant="outline"
        className={`${buttonSize} rounded-full`}
        onClick={handleDecrease}
        disabled={!canDecrease}
        aria-label="减少数量"
        title="减少数量"
      >
        <Minus className={iconSize} />
      </Button>
      <input
        type="text"
        inputMode={measureType === 'INT' ? 'numeric' : 'decimal'}
        value={displayValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        className={`${inputWidth} border-none bg-transparent text-center font-medium outline-none ${textSize}`}
      />
      <Button
        size="icon"
        variant="outline"
        className={`${buttonSize} rounded-full`}
        onClick={handleIncrease}
        disabled={!canIncrease}
        aria-label="增加数量"
        title="增加数量"
      >
        <Plus className={iconSize} />
      </Button>
    </div>
  )
}
