import { describe, expect, it } from 'vitest'
import { refreshFailureCasesForSkill } from '@/lib/failureRefresh'

describe('failureRefresh — 回流后刷新失败库', () => {
  it('从某个 Skill 的 compat reports 聚合并 upsert FailureCase', async () => {
    const writes: any[] = []
    const payload = {
      find: async (args: any) => {
        if (args.collection === 'compat-reports') {
          return {
            docs: [
              {
                errorType: 'json_invalid',
                modelName: 'qwen-plus',
                modelVersion: '2026-07-01',
                skill: { id: 'skill-1', title: 'JSON Skill', slug: 'json-skill' },
                inputSizeBucket: '100-500',
                outputSizeBucket: '0-100',
                source: 'online',
              },
              {
                errorType: 'json_invalid',
                modelName: 'deepseek-chat',
                modelVersion: '2026-07-01',
                skill: { id: 'skill-1', title: 'JSON Skill', slug: 'json-skill' },
                inputSizeBucket: '100-500',
                outputSizeBucket: '0-100',
                source: 'benchmark',
              },
            ],
          }
        }
        if (args.collection === 'failure-cases') return { docs: [] }
        return { docs: [] }
      },
      findGlobal: async () => ({}),
      create: async (args: any) => {
        writes.push(args)
        return { id: args.collection === 'failure-cases' ? 'case-1' : 'snap-1', ...args.data }
      },
      logger: { warn: () => undefined, error: () => undefined },
    }

    await expect(refreshFailureCasesForSkill(payload as any, 'skill-1')).resolves.toEqual({ processed: 1 })
    expect(writes[0]).toMatchObject({
      collection: 'failure-cases',
      data: {
        profileKey: 'skill-1|100-500|json_invalid|2026-07-01',
        errorType: 'json_invalid',
        primaryInputBucket: '100-500',
        modelBreakdown: { 'qwen-plus': 1, 'deepseek-chat': 1 },
      },
    })
    expect(writes[1]).toMatchObject({
      collection: 'evidence-snapshots',
      data: { targetType: 'failure_case', targetId: 'case-1', evidenceHash: writes[0].data.evidenceHash },
    })
  })
})
