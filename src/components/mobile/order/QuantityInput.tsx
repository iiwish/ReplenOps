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

  const step = measureType === 'INT' ? 1 : 0.1
  const minValue = measureType === 'INT' ? Math.max(1, min) : Math.max(0.001, min)

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

  // 根据 size 调整按钮和文本大小
  const buttonSize = size === 'sm' ? 'h-7 w-7 min-h-[36px] min-w-[36px]' : size === 'lg' ? 'h-10 w-10 min-h-[52px] min-w-[52px]' : 'h-8 w-8 min-h-[44px] min-w-[44px]'
  const textSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base'
  const inputWidth = size === 'sm' ? 'min-w-[50px]' : size === 'lg' ? 'min-w-[70px]' : 'min-w-[60px]'

  return (
    <div className="flex items-center gap-2">
      <Button
        size="icon"
        variant="outline"
        className={`${buttonSize} rounded-full`}
        onClick={handleDecrease}
        disabled={!canDecrease}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <input
        type="text"
        inputMode={measureType === 'INT' ? 'numeric' : 'decimal'}
        value={displayValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        className={`${inputWidth} text-center font-medium bg-transparent border-none outline-none ${textSize}`}
      />
      <Button
        size="icon"
        variant="outline"
        className={`${buttonSize} rounded-full`}
        onClick={handleIncrease}
        disabled={!canIncrease}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
