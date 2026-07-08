import { describe, expect, it } from 'vitest'
import { deriveBenchmarkCases, deriveBenchmarkInputs, deriveInputsFromVersion } from '@/lib/benchmark'

describe('benchmark inputs — CompatTestCase 优先', () => {
  it('无 CompatTestCase 时从 examples 派生输入', () => {
    expect(deriveInputsFromVersion({ examples: [{ input: { topic: 'A' } }] })).toEqual([{ topic: 'A' }])
  })

  it('优先读取启用的 CompatTestCase', async () => {
    const calls: any[] = []
    const payload = {
      find: async (args: any) => {
        calls.push(args)
        return { docs: [{ inputJson: { topic: 'case' } }] }
      },
    }
    const inputs = await deriveBenchmarkInputs(payload as any, 'skill-1', { id: 'v1', examples: [{ input: { topic: 'example' } }] })
    expect(inputs).toEqual([{ topic: 'case' }])
    expect(calls[0]).toMatchObject({
      collection: 'compat-test-cases',
      limit: 5,
      where: { and: [{ skill: { equals: 'skill-1' } }, { enabled: { equals: true } }, expect.any(Object)] },
    })
  })

  it('保留 CompatTestCase 元数据供黄金样例逐条打分', async () => {
    const payload = {
      find: async () => ({ docs: [{ id: 'case-1', title: '黄金样例', inputJson: { topic: 'case' }, requiredOutputPaths: ['title'], minScore: 0.9 }] }),
    }
    const cases = await deriveBenchmarkCases(payload as any, 'skill-1', { id: 'v1' })
    expect(cases).toEqual([{ input: { topic: 'case' }, testCase: expect.objectContaining({ id: 'case-1', title: '黄金样例' }) }])
  })
})
