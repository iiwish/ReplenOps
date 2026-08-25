export interface ContainerRequirementBinding {
  containerId: number
  containerCode: string
  containerName: string
  containerUnit: string
  goodsQuantityPerContainer: number
  isActive: boolean
  isDeleted: boolean
}

export interface ContainerRequirementItem {
  goodsId: number
  goodsName: string
  goodsUnit: string
  quantity: number
  bindings: ContainerRequirementBinding[]
}

export interface ContainerRequirementSource {
  goodsId: number
  goodsName: string
  goodsUnit: string
  goodsQuantity: number
  goodsQuantityPerContainer: number
  expectedQuantity: number
}

export interface ContainerRequirement {
  containerId: number
  containerCode: string
  containerName: string
  containerUnit: string
  expectedQuantity: number
  sources: ContainerRequirementSource[]
}

export function calculateContainerRequirements(
  items: ContainerRequirementItem[]
): ContainerRequirement[] {
  const requirements = new Map<number, ContainerRequirement>()

  for (const item of items) {
    for (const binding of item.bindings) {
      if (!binding.isActive || binding.isDeleted || binding.goodsQuantityPerContainer <= 0) continue

      const expectedQuantity = Math.ceil(item.quantity / binding.goodsQuantityPerContainer)
      if (expectedQuantity <= 0) continue

      const existing = requirements.get(binding.containerId)
      const source: ContainerRequirementSource = {
        goodsId: item.goodsId,
        goodsName: item.goodsName,
        goodsUnit: item.goodsUnit,
        goodsQuantity: item.quantity,
        goodsQuantityPerContainer: binding.goodsQuantityPerContainer,
        expectedQuantity,
      }

      if (existing) {
        existing.expectedQuantity += expectedQuantity
        existing.sources.push(source)
      } else {
        requirements.set(binding.containerId, {
          containerId: binding.containerId,
          containerCode: binding.containerCode,
          containerName: binding.containerName,
          containerUnit: binding.containerUnit,
          expectedQuantity,
          sources: [source],
        })
      }
    }
  }

  return Array.from(requirements.values()).sort(
    (left, right) =>
      left.containerCode.localeCompare(right.containerCode, 'zh-CN') ||
      left.containerId - right.containerId
  )
}
