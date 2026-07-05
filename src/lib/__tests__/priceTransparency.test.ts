import { describe, expect, it } from 'vitest'
import { comparePriceTransparency, sumModelPrice } from '@/lib/priceTransparency'

describe('priceTransparency — 官方价 vs 我到手价展示隔离', () => {
  it('合并输入/输出价并保留四位小数', () => {
    expect(sumModelPrice({ input: 0.00123, output: 0.00234 })).toBe(0.0036)
  })

  it('缺任一列价格时返回 null，避免拿默认价误导 BYOK 结论', () => {
    expect(sumModelPrice({ input: 0.001 })).toBeNull()
    expect(comparePriceTransparency({ official: { input: 0.001, output: 0.002 }, platform: null })).toMatchObject({
      platformPrice: null,
      byokCheaper: false,
    })
  })

  it('平台到手价高于官方价时红标 BYOK 更省', () => {
    const r = comparePriceTransparency({
      official: { input: 0.001, output: 0.002 },
      platform: { input: 0.004, output: 0.005 },
    })
    expect(r).toMatchObject({
      officialPrice: 0.003,
      platformPrice: 0.009,
      platformDelta: 0.006,
      byokCheaper: true,
    })
  })

  it('平台到手价不高于官方价时不红标', () => {
    const r = comparePriceTransparency({
      official: { input: 0.004, output: 0.005 },
      platform: { input: 0.001, output: 0.002 },
    })
    expect(r.byokCheaper).toBe(false)
    expect(r.platformDelta).toBe(-0.006)
  })
})
