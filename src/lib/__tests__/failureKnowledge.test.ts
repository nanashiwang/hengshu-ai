import { describe, expect, it } from 'vitest'
import { aggregateFailureKnowledge } from '@/lib/failureKnowledge'

describe('failureKnowledge — 失败知识库聚合', () => {
  it('按 skill + 输入档 + errorType + modelVersion 聚合，只输出摘要不依赖原文', () => {
    const groups = aggregateFailureKnowledge([
      {
        errorType: 'json_invalid',
        modelName: 'deepseek-chat',
        modelVersion: '2026-07-01',
        skill: { id: 's1', title: 'JSON Skill', slug: 'json-skill' },
        inputSizeBucket: '500-2k',
        outputSizeBucket: '0-100',
        source: 'online',
      },
      {
        errorType: 'json_invalid',
        modelName: 'deepseek-chat',
        modelVersion: '2026-07-02',
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
      profileKey: 's1|500-2k|json_invalid|2026-07-01',
      errorType: 'json_invalid',
      modelName: 'deepseek-chat',
      primaryInputBucket: '500-2k',
      primaryModelVersion: '2026-07-01',
      count: 1,
      skillCount: 1,
      inputBuckets: ['500-2k'],
      modelBreakdown: { 'deepseek-chat': 1 },
      modelVersions: ['2026-07-01'],
      modelVersionBreakdown: { '2026-07-01': 1 },
      sourceBreakdown: { online: 1 },
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

  it('同类错误按任务输入画像分组，模型只作为分布事实', () => {
    const groups = aggregateFailureKnowledge([
      { errorType: 'format_drift', modelName: 'm1', modelVersion: 'v1', skill: 's1', inputSizeBucket: '0-100' },
      { errorType: 'format_drift', modelName: 'm2', modelVersion: 'v1', skill: 's1', inputSizeBucket: '0-100' },
      { errorType: 'format_drift', modelName: 'm2', modelVersion: 'v2', skill: 's1', inputSizeBucket: '8k+' },
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0].modelBreakdown).toMatchObject({ m1: 1, m2: 1 })
    expect(groups.map((g) => g.profileKey).sort()).toEqual(['s1|0-100|format_drift|v1', 's1|8k+|format_drift|v2'])
  })
})
