import { describe, expect, it } from 'vitest'
import { aggregateByModel, aggregateModelsGlobal, compatLookbackStartISO, COMPAT_LOOKBACK_DAYS } from '@/lib/compat'

describe('compat — 活体数据窗口', () => {
  it('lookback 固定为近 180 天', () => {
    expect(compatLookbackStartISO(new Date('2026-07-03T00:00:00.000Z'))).toBe('2026-01-04T00:00:00.000Z')
    expect(COMPAT_LOOKBACK_DAYS).toBe(180)
  })

  it('按 skill + createdAt 窗口分页读取，避免 5000 条全量同步重算', async () => {
    const calls: any[] = []
    const payload = {
      find: async (args: any) => {
        calls.push(args)
        return {
          docs: [
            {
              modelName: 'deepseek-chat',
              success: true,
              formatValid: true,
              latencyMs: 100,
              source: 'benchmark',
              createdAt: new Date().toISOString(),
            },
          ],
          hasNextPage: false,
        }
      },
    }

    await aggregateByModel(payload as any, 'skill-1')
    expect(calls[0]).toMatchObject({
      collection: 'compat-reports',
      limit: 500,
      sort: 'id',
      where: {
        and: [{ skill: { equals: 'skill-1' } }, { createdAt: { greater_than_equal: expect.any(String) } }],
      },
    })
  })

  it('公开模型榜可只聚合 published + public Skill 的兼容报告', async () => {
    const calls: any[] = []
    const payload = {
      find: async (args: any) => {
        calls.push(args)
        return { docs: [], hasNextPage: false }
      },
    }

    await aggregateModelsGlobal(payload as any, { publicSkillOnly: true })
    expect(calls[0].where.and).toEqual([
      { createdAt: { greater_than_equal: expect.any(String) } },
      { 'skill.status': { equals: 'published' } },
      { 'skill.visibility': { equals: 'public' } },
    ])
  })

  it('优先按 modelProfile 聚合，避免同名不同版本混成一组', async () => {
    const payload = {
      find: async () => ({
        docs: [
          {
            modelName: 'qwen-plus',
            modelVersion: '2026-06',
            modelProfile: 'profile-a',
            success: true,
            formatValid: true,
            latencyMs: 100,
            source: 'benchmark',
            createdAt: new Date().toISOString(),
          },
          {
            modelName: 'qwen-plus',
            modelVersion: '2026-07',
            modelProfile: 'profile-b',
            success: false,
            formatValid: false,
            latencyMs: 200,
            source: 'benchmark',
            createdAt: new Date().toISOString(),
          },
        ],
        hasNextPage: false,
      }),
    }

    const rows = await aggregateByModel(payload as any, 'skill-1')

    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.modelProfile).sort()).toEqual(['profile-a', 'profile-b'])
    expect(rows.map((r) => r.modelVersion).sort()).toEqual(['2026-06', '2026-07'])
  })

  it('输出来源分级权重和有效样本，解释兼容数据可信度', async () => {
    const now = new Date().toISOString()
    const payload = {
      find: async () => ({
        docs: [
          { modelName: 'qwen-plus', success: true, formatValid: true, latencyMs: 100, source: 'verified', createdAt: now },
          { modelName: 'qwen-plus', success: true, formatValid: true, latencyMs: 100, source: 'community', createdAt: now },
          { modelName: 'qwen-plus', success: false, formatValid: false, latencyMs: 300, source: 'online', createdAt: now },
        ],
        hasNextPage: false,
      }),
    }

    const [row] = await aggregateByModel(payload as any, 'skill-1')

    expect(row.reports).toBe(3)
    expect(row.effectiveSamples).toBeGreaterThan(1.7)
    expect(row.effectiveSamples).toBeLessThanOrEqual(1.8)
    expect(row.sourceSummary).toEqual([
      { source: 'verified', count: 1, weight: 1 },
      { source: 'community', count: 1, weight: 0.5 },
      { source: 'online', count: 1, weight: 0.3 },
    ])
    expect(row.successRate).toBeGreaterThan(0.8)
    expect(row.successRate).toBeLessThan(0.9)
  })

  it('全站模型画像按输入规模档输出细粒度成功率', async () => {
    const now = new Date().toISOString()
    const payload = {
      find: async () => ({
        docs: [
          { modelName: 'qwen-plus', inputSizeBucket: '0-100', success: true, formatValid: true, source: 'verified', createdAt: now },
          { modelName: 'qwen-plus', inputSizeBucket: '0-100', success: false, formatValid: true, source: 'verified', createdAt: now },
          { modelName: 'qwen-plus', inputSizeBucket: '8k+', success: false, formatValid: false, source: 'community', createdAt: now },
        ],
        hasNextPage: false,
      }),
    }

    const [row] = await aggregateModelsGlobal(payload as any)

    expect(row.inputBucketSummary).toEqual([
      { inputBucket: '0-100', count: 2, effectiveSamples: 2, successRate: 0.5, formatRate: 1 },
      { inputBucket: '8k+', count: 1, effectiveSamples: 0.5, successRate: 0, formatRate: 0 },
    ])
  })
})
