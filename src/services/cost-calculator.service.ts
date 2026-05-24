/**
 * 成本计算服务
 * 提供加权平均成本计算功能
 */
export class CostCalculator {
  /**
   * 计算加权平均成本
   * @param currentQty 当前库存数量
   * @param currentCost 当前成本
   * @param inQty 入库数量
   * @param inPrice 入库价格
   * @returns 新的加权平均成本
   */
  calculateWeightedAvgCost(params: {
    currentQty: number
    currentCost: number
    inQty: number
    inPrice: number
  }): number {
    const { currentQty, currentCost, inQty, inPrice } = params

    // 特殊情况：当前库存为0，直接使用入库价格
    if (currentQty === 0) {
      return inPrice
    }

    // 加权平均计算
    const totalValue = currentQty * currentCost + inQty * inPrice
    const totalQty = currentQty + inQty

    // 避免除以零
    if (totalQty === 0) {
      return 0
    }

    // 保留2位小数
    return Math.round((totalValue / totalQty) * 100) / 100
  }
}

// 导出单例
export const costCalculator = new CostCalculator()
