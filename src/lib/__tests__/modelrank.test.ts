import { describe, it, expect } from 'vitest'
import { rankModels, qualityScore } from '@/lib/modelrank'

const row = (over: any) => ({
  model: 'm',
  successRate: 0.9,
  formatRate: 0.9,
  avgLatencyMs: 500,
  samples: 10,
  ...over,
})

describe('modelrank — 中立模型榜(无 margin/isOurs)', () => {
  it('qualityScore 成功率主导', () => {
    expect(qualityScore({ successRate: 1, formatRate: 1 })).toBe(100)
    expect(qualityScore({ successRate: 1, formatRate: 0 })).toBe(70)
    expect(qualityScore({ successRate: 0, formatRate: 1 })).toBe(30)
  })

  it('value 排序：性价比(质量/官方价)高者在前', () => {
    const rows = [
      row({ model: 'cheap-good', successRate: 0.9, officialInputPrice: 0.001, officialOutputPrice: 0.002 }),
      row({ model: 'pricey-good', successRate: 0.95, officialInputPrice: 0.05, officialOutputPrice: 0.05 }),
    ]
    const r = rankModels(rows, 'value')
    expect(r[0].model).toBe('cheap-good') // 质量相近但便宜得多→性价比高
    expect(r[0].valueScore).toBeGreaterThan(r[1].valueScore!)
  })

  it('低样本一律沉底', () => {
    const rows = [
      row({ model: 'proven', samples: 20, successRate: 0.8 }),
      row({ model: 'newbie', samples: 2, successRate: 1, officialInputPrice: 0, officialOutputPrice: 0 }),
    ]
    const r = rankModels(rows, 'quality')
    expect(r[0].model).toBe('proven')
    expect(r[1].lowSample).toBe(true)
  })

  it('无官方价 → officialPrice/valueScore 为 null，仍可按质量排', () => {
    const r = rankModels([row({ officialInputPrice: undefined, officialOutputPrice: undefined })], 'quality')
    expect(r[0].officialPrice).toBeNull()
    expect(r[0].valueScore).toBeNull()
  })

  it('price 排序按官方价升序，无价沉后', () => {
    const rows = [
      row({ model: 'a', officialInputPrice: 0.05, officialOutputPrice: 0.05 }),
      row({ model: 'b', officialInputPrice: 0.001, officialOutputPrice: 0.001 }),
      row({ model: 'c' }),
    ]
    const r = rankModels(rows, 'price')
    expect(r[0].model).toBe('b')
    expect(r[1].model).toBe('a')
  })
})
