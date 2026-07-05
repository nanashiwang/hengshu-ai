import { describe, expect, it } from 'vitest'
import { aggregateFailureKnowledge } from '@/lib/failureKnowledge'

describe('failureKnowledge — 失败知识库聚合', () => {
  it('按 errorType + model 聚合，只输出摘要不依赖原文', () => {
    const groups = aggregateFailureKnowledge([
      {
        errorType: 'json_invalid',
        modelName: 'deepseek-chat',
        skill: { id: 's1', title: 'JSON Skill', slug: 'json-skill' },
        inputSizeBucket: '500-2k',
        outputSizeBucket: '0-100',
        source: 'online',
      },
      {
        errorType: 'json_invalid',
        modelName: 'deepseek-chat',
        skill: { id: 's1', title: 'JSON Skill', slug: 'json-skill' },
        inputSizeBucket: '500-2k',
        outputSizeBucket: '0-100',
        source: 'benchmark',
      },
      {
        errorType: 'timeout',
        modelName: 'qwen-plus',
        skill: { id: 's2', title: 'Long Skill' },
        inputSizeBucket: '8k+',
        source: 'online',
      },
    ])

    expect(groups[0]).toMatchObject({
      errorType: 'json_invalid',
      modelName: 'deepseek-chat',
      count: 2,
      skillCount: 1,
      inputBuckets: ['500-2k'],
      sourceBreakdown: { online: 1, benchmark: 1 },
    })
    expect(groups[0].meta.publicFixHint).toContain('JSON')
  })

  it('抑制报告和无 errorType 报告不进入公开知识库', () => {
    const groups = aggregateFailureKnowledge([
      { errorType: 'auth', modelName: 'm', suppressed: true },
      { errorType: '', modelName: 'm' },
      { modelName: 'm' },
    ])
    expect(groups).toEqual([])
  })

  it('同类错误按模型分组，避免把不同模型问题混成一个结论', () => {
    const groups = aggregateFailureKnowledge([
      { errorType: 'format_drift', modelName: 'm1', skill: 's1' },
      { errorType: 'format_drift', modelName: 'm2', skill: 's1' },
    ])
    expect(groups.map((g) => g.modelName).sort()).toEqual(['m1', 'm2'])
  })
})
