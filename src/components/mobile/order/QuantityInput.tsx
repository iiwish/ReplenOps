'use client'

import { Button } from '@/components/ui/button'
import { Minus, Plus } from 'lucide-react'

interface QuantityInputProps {
  value: number
  measureType: 'INT' | 'DECIMAL'
  max: number
  min?: number
  onChange: (value: number) => void
}

export function QuantityInput({
  value,
  measureType,
  max,
  min = 0,
  onChange,
}: QuantityInputProps) {
  const step = measureType === 'INT' ? 1 : 0.1

  const handleDecrease = () => {
    const newValue = Math.max(min, value - step)
    onChange(parseFloat(newValue.toFixed(3)))
  }

  const handleIncrease = () => {
    const newValue = Math.min(max, value + step)
    onChange(parseFloat(newValue.toFixed(3)))
  }

  const canDecrease = value > min
  const canIncrease = value < max

  return (
    <div className="flex items-center gap-2">
      <Button
        size="icon"
        variant="outline"
        className="h-8 w-8 min-h-[44px] min-w-[44px] rounded-full"
        onClick={handleDecrease}
        disabled={!canDecrease}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="min-w-[60px] text-center font-medium">
        {measureType === 'INT' ? value : value.toFixed(1)}
      </span>
      <Button
        size="icon"
        variant="outline"
        className="h-8 w-8 min-h-[44px] min-w-[44px] rounded-full"
        onClick={handleIncrease}
        disabled={!canIncrease}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
