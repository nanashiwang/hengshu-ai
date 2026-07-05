export interface PricePair {
  input?: number | null
  output?: number | null
}

export interface PriceTransparency {
  officialPrice: number | null
  platformPrice: number | null
  byokCheaper: boolean
  platformDelta: number | null
}

function finitePrice(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

export function sumModelPrice(price: PricePair | null | undefined): number | null {
  const input = finitePrice(price?.input)
  const output = finitePrice(price?.output)
  if (input == null || output == null) return null
  return Math.round((input + output) * 10000) / 10000
}

// 四面墙·履约隔离：只做展示比较，不参与 modelrank 排序。
export function comparePriceTransparency(args: {
  official?: PricePair | null
  platform?: PricePair | null
}): PriceTransparency {
  const officialPrice = sumModelPrice(args.official)
  const platformPrice = sumModelPrice(args.platform)
  const platformDelta =
    officialPrice != null && platformPrice != null
      ? Math.round((platformPrice - officialPrice) * 10000) / 10000
      : null
  return {
    officialPrice,
    platformPrice,
    byokCheaper: platformDelta != null && platformDelta > 0,
    platformDelta,
  }
}
