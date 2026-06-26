import { MODEL_PRICES } from './constants'

// 按 token 与价格表估算成本（人民币元）
export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const price = MODEL_PRICES[model] || MODEL_PRICES.default
  const cost = (promptTokens / 1000) * price.in + (completionTokens / 1000) * price.out
  return Math.round(cost * 10000) / 10000
}
