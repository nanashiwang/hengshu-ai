import { describe, expect, it } from 'vitest'
import { buildApprovedAdapterWhere, buildFailureReverifyPlan, buildFailureReverifyRunWhere } from '@/lib/reverifyPlan'

describe('reverifyPlan — 失败库自动复验计划', () => {
  const failure = {
    id: 'failure-1',
    title: 'JSON 解析失败',
    skill: { id: 'skill-1', slug: 'writer', title: 'Writer' },
    skillVersion: 'version-1',
    errorType: 'json_parse_error',
    modelName: 'qwen-plus',
    primaryModelVersion: '2026-07-01',
    profileKey: 'skill-1|500-2k|json_parse_error',
    primaryInputBucket: '500-2k',
    verificationCoverage: { targetRuns: 5, verifiedRuns: 2, beforeSuccessRate: 0.2 },
  }

  it('构造私人台账候选运行查询，限定本人、同 Skill、同模型版本和错误类型', () => {
    expect(buildFailureReverifyRunWhere('user-1', failure)).toEqual({
      and: [
        { user: { equals: 'user-1' } },
        { success: { equals: false } },
        { skill: { equals: 'skill-1' } },
        { model: { equals: 'qwen-plus' } },
        { modelVersion: { equals: '2026-07-01' } },
        { errorCode: { equals: 'json_parse_error' } },
      ],
    })
  })

  it('构造已批准 Adapter 查询，不把未评审草稿放入复验计划', () => {
    expect(buildApprovedAdapterWhere(failure)).toEqual({
      and: [
        { status: { equals: 'active' } },
        { or: [{ reviewStatus: { equals: 'approved' } }, { reviewStatus: { exists: false } }] },
        { sourceFailureCase: { equals: 'failure-1' } },
        { skill: { equals: 'skill-1' } },
        { modelName: { equals: 'qwen-plus' } },
        { or: [{ modelVersion: { equals: '2026-07-01' } }, { modelVersion: { exists: false } }] },
      ],
    })
  })

  it('输出可执行复验计划，不暴露原始输入输出或补丁正文', () => {
    const plan = buildFailureReverifyPlan({
      failureCase: failure,
      candidateRuns: [
        {
          id: 'run-1',
          runId: 'r_1',
          skill: { id: 'skill-1', slug: 'writer', title: 'Writer' },
          model: 'qwen-plus',
          modelVersion: '2026-07-01',
          errorCode: 'json_parse_error',
          success: false,
          formatValid: false,
          inputJson: { secret: 'raw' },
          outputText: 'secret output',
          createdAt: '2026-07-08T00:00:00.000Z',
        },
      ],
      adapters: [
        {
          id: 'adapter-1',
          title: 'JSON 修复',
          modelName: 'qwen-plus',
          modelVersion: '2026-07-01',
          liftScore: 0.4,
          afterMetrics: { samples: 4 },
          systemPromptAppend: 'secret patch',
        },
      ],
    }) as any

    expect(plan).toMatchObject({
      decision: 'rerun_with_approved_adapter',
      coverage: { targetRuns: 5, verifiedRuns: 2, remainingRuns: 3, enough: false },
      candidateRunCount: 1,
      candidateRuns: [
        expect.objectContaining({
          id: 'run-1',
          rerunUrl: '/v1/runs/run-1/rerun',
          rerunBody: { model: 'qwen-plus', modelVersion: '2026-07-01' },
        }),
      ],
      approvedAdapters: [
        expect.objectContaining({
          id: 'adapter-1',
          evidenceVerifyPageUrl: '/verify?targetType=adapter_profile&targetId=adapter-1',
        }),
      ],
      nextActions: expect.arrayContaining([
        expect.objectContaining({ label: '筛出同类失败运行' }),
        expect.objectContaining({ label: '用同输入复验已批准 Adapter' }),
        expect.objectContaining({ label: '更新复验覆盖' }),
      ]),
    })
    expect(JSON.stringify(plan)).not.toContain('secret')
    expect(JSON.stringify(plan)).not.toContain('raw')
    expect(JSON.stringify(plan)).not.toContain('secret output')
    expect(JSON.stringify(plan)).not.toContain('secret patch')
  })

  it('没有私人候选运行时，明确先收集失败而不是伪造结论', () => {
    const plan = buildFailureReverifyPlan({ failureCase: { ...failure, verificationCoverage: {} }, candidateRuns: [], adapters: [] }) as any
    expect(plan.decision).toBe('collect_private_failures')
    expect(plan.coverage).toMatchObject({ targetRuns: 3, verifiedRuns: 0, remainingRuns: 3 })
  })
})
