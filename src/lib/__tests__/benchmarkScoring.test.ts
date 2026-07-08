import { describe, expect, it } from 'vitest'
import { evaluateBenchmarkCaseResult } from '@/lib/benchmarkScoring'

describe('benchmarkScoring — 黄金样例逐条打分', () => {
  it('按 JSON 路径、输出形状和文本包含项打分', () => {
    const result = evaluateBenchmarkCaseResult({
      ok: true,
      formatValid: true,
      output: '标题：通过',
      outputJson: { title: '通过', items: [{ name: 'A' }] },
      testCase: {
        expectedOutputShape: { title: '', items: [{ name: '' }] },
        requiredOutputPaths: ['items.0.name'],
        expectedTextIncludes: ['标题'],
        minScore: 0.8,
      },
    })
    expect(result?.passed).toBe(true)
    expect(result?.score).toBe(1)
  })

  it('缺失黄金样例要求时给出未通过分数', () => {
    const result = evaluateBenchmarkCaseResult({
      ok: true,
      formatValid: false,
      output: 'hello',
      outputJson: { title: 'x' },
      testCase: { requiredOutputPaths: ['items.0.name'], expectedTextIncludes: ['必须出现'], minScore: 0.8 },
    })
    expect(result?.passed).toBe(false)
    expect(result?.score).toBeLessThan(0.8)
  })
})
