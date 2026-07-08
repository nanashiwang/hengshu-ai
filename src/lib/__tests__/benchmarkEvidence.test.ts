import { describe, expect, it } from 'vitest'
import { getSkillBenchmarkEvidence, summarizeBenchmarkEvidence } from '@/lib/benchmarkEvidence'

describe('benchmarkEvidence — 黄金样例前台摘要', () => {
  it('按样例聚合分数、通过数和模型集合', () => {
    const summary = summarizeBenchmarkEvidence([
      { modelName: 'deepseek-chat', benchmarkScore: 1, benchmarkPassed: true, benchmarkCase: { id: 'c1', title: 'JSON 标题' }, createdAt: '2026-01-01' },
      { modelName: 'qwen-plus', benchmarkScore: 0.5, benchmarkPassed: false, benchmarkCase: { id: 'c1', title: 'JSON 标题' }, createdAt: '2026-01-02' },
      { modelName: 'qwen-plus', benchmarkScore: 0.8, benchmarkPassed: true, benchmarkCase: { id: 'c2', title: '边界输入' } },
    ])
    expect(summary).toMatchObject({ total: 3, passed: 2, averageScore: 0.767, evidenceHash: expect.any(String) })
    expect(summary.cases[1]).toMatchObject({ caseId: 'c1', total: 2, passed: 1, averageScore: 0.75, models: ['deepseek-chat', 'qwen-plus'], lastRunAt: '2026-01-02' })
    const same = summarizeBenchmarkEvidence([
      { benchmarkCase: { title: '边界输入', id: 'c2' }, benchmarkPassed: true, benchmarkScore: 0.8, modelName: 'qwen-plus' },
      { createdAt: '2026-01-02', benchmarkCase: { title: 'JSON 标题', id: 'c1' }, benchmarkPassed: false, benchmarkScore: 0.5, modelName: 'qwen-plus' },
      { createdAt: '2026-01-01', benchmarkCase: { title: 'JSON 标题', id: 'c1' }, benchmarkPassed: true, benchmarkScore: 1, modelName: 'deepseek-chat' },
    ])
    expect(summary.evidenceHash).toHaveLength(64)
    expect(same.evidenceHash).toBe(summary.evidenceHash)
  })


  it('从 compat-reports 查询并生成公开 Passport 可复用摘要', async () => {
    const calls: any[] = []
    const payload = {
      find: async (args: any) => {
        calls.push(args)
        return { docs: [{ modelName: 'deepseek-chat', benchmarkScore: 1, benchmarkPassed: true, benchmarkCase: 'case-1' }] }
      },
    }
    const summary = await getSkillBenchmarkEvidence(payload, 'skill-1')
    expect(summary).toMatchObject({ total: 1, passed: 1, averageScore: 1 })
    expect(calls[0]).toMatchObject({
      collection: 'compat-reports',
      depth: 1,
      overrideAccess: true,
      where: { and: [{ skill: { equals: 'skill-1' } }, { source: { equals: 'benchmark' } }, { benchmarkScore: { exists: true } }] },
    })
  })
})
