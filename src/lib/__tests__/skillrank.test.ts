import { describe, expect, it } from 'vitest'
import { skillRankFromAggregates, trustedCompatibleEvidenceScore } from '@/lib/skillrank'

describe('skillrank — 可信分', () => {
  it('无可信兼容计数时保持旧聚合指标口径', () => {
    const rank = skillRankFromAggregates({
      successRate: 0.8,
      formatSuccessRate: 0.7,
      avgCost: 0.01,
      avgLatencyMs: 1000,
      avgRating: 4,
      lastUpdatedAt: new Date().toISOString(),
    })
    expect(rank).toBeGreaterThan(60)
    expect(rank).toBeLessThan(90)
  })

  it('可信兼容运行数提高可信分，但使用对数饱和避免刷量支配', () => {
    const base = {
      successRate: 0.8,
      formatSuccessRate: 0.7,
      avgCost: 0.01,
      avgLatencyMs: 1000,
      avgRating: 4,
      lastUpdatedAt: new Date().toISOString(),
    }
    const noEvidence = skillRankFromAggregates({ ...base, trustedCompatibleRunCount: 0 })
    const proven = skillRankFromAggregates({ ...base, trustedCompatibleRunCount: 100 })
    expect(proven).toBeGreaterThan(noEvidence)
    expect(proven - noEvidence).toBeLessThanOrEqual(15)
    expect(trustedCompatibleEvidenceScore(0)).toBe(0)
    expect(trustedCompatibleEvidenceScore(100)).toBe(1)
  })
})
