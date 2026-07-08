import { describe, expect, it, vi } from 'vitest'
import {
  enterprisePrivateBenchmark,
  normalizeEnterpriseBenchmarkRequest,
  resolveEnterpriseBenchmarkModels,
  summarizeEnterpriseBenchmarkResults,
} from '@/lib/enterpriseBenchmark'

describe('enterpriseBenchmark — 企业私有评测', () => {
  it('规范化私有样例但不把输入输出作为公开结果字段', () => {
    const normalized = normalizeEnterpriseBenchmarkRequest({
      models: ['qwen-plus', 'qwen-plus', 'deepseek-chat'],
      maxAttempts: 3,
      cases: [
        {
          title: '财务内部样例',
          input: { text: 'confidential revenue plan' },
          requiredOutputPaths: ['summary'],
          expectedTextIncludes: ['only-in-check'],
          minScore: 0.6,
        },
      ],
    })

    expect(normalized).toMatchObject({
      ok: true,
      models: ['qwen-plus', 'deepseek-chat'],
      maxAttempts: 3,
    })
    expect((normalized as any).cases[0]).toMatchObject({
      privateCase: true,
      testCase: { title: '财务内部样例', minScore: 0.6 },
    })
  })

  it('模型必须被 Registry 或组织白名单允许', () => {
    expect(resolveEnterpriseBenchmarkModels({
      requested: ['deepseek-chat', 'qwen-plus'],
      registryAllowlist: { models: ['qwen-plus'] },
    })).toEqual({
      models: ['qwen-plus'],
      rejectedModels: ['deepseek-chat'],
    })

    expect(resolveEnterpriseBenchmarkModels({
      version: { recommendedModels: { cloud: ['qwen-plus'] } },
    })).toEqual({
      models: ['qwen-plus'],
      rejectedModels: [],
    })
  })

  it('汇总 byModel、得分和通过数', () => {
    expect(summarizeEnterpriseBenchmarkResults([
      { model: 'qwen-plus', caseId: 'c1', title: 'c1', ok: true, formatValid: true, scored: true, score: 1, passed: true },
      { model: 'qwen-plus', caseId: 'c2', title: 'c2', ok: false, formatValid: false, scored: true, score: 0.25, passed: false },
      { model: 'deepseek-chat', caseId: 'c1', title: 'c1', ok: true, formatValid: false, scored: false },
    ])).toMatchObject({
      attempted: 3,
      succeeded: 2,
      formatValid: 1,
      scored: 2,
      passed: 1,
      averageScore: 0.625,
      byModel: [
        { model: 'qwen-plus', attempted: 2, succeeded: 1, scored: 2, passed: 1, averageScore: 0.625 },
        { model: 'deepseek-chat', attempted: 1, succeeded: 1, scored: 0, passed: 0, averageScore: 0 },
      ],
    })
  })

  it('普通成员不能发起，管理员发起时不写公开兼容报告且不回显私有输入', async () => {
    const registry = {
      id: 'reg-1',
      organization: { id: 'org-1', owner: 'owner-1', status: 'active' },
      skill: { id: 'skill-1', slug: 'finance', title: 'Finance Skill' },
      skillVersion: 'ver-1',
      approvalStatus: 'pending',
      modelAllowlist: { models: ['qwen-plus'] },
      auditPolicy: { maxInputChars: 1000 },
    }
    const version = {
      id: 'ver-1',
      skill: 'skill-1',
      status: 'active',
      promptTemplate: '{{text}}',
      inputSchema: { text: { type: 'text', required: true } },
      outputSchema: { summary: { type: 'text' } },
      recommendedModels: { cloud: ['qwen-plus'] },
    }
    const find = vi.fn(async (args: any) => {
      if (args.collection === 'organization-members') return { totalDocs: 1, docs: [{ id: 'm1', role: 'member' }] }
      return { totalDocs: 0, docs: [] }
    })
    const payload = {
      findByID: vi.fn(async (args: any) => {
        if (args.collection === 'enterprise-registries') return registry
        if (args.collection === 'organizations') return { id: 'org-1', owner: 'owner-1', status: 'active' }
        if (args.collection === 'skill-versions') return version
        return null
      }),
      find,
    }

    await expect(enterprisePrivateBenchmark(payload as any, {
      actorId: 'member-1',
      registryId: 'reg-1',
      models: ['qwen-plus'],
      cases: [{ input: { text: 'confidential input' }, testCase: { title: 'secret case', requiredOutputPaths: ['summary'] }, privateCase: true }],
    })).resolves.toMatchObject({ ok: false })

    const runSkill = vi.fn(async () => ({
      ok: true,
      runId: 'run-1',
      skillRunId: 'skill-run-1',
      model: 'qwen-plus',
      mocked: false,
      formatValid: true,
      benchmarkScore: { score: 1, passed: true, checks: [{ code: 'run_ok', ok: true, message: '运行成功' }] },
    }))

    const result = await enterprisePrivateBenchmark(payload as any, {
      actorId: 'platform-admin',
      actorRole: 'admin',
      registryId: 'reg-1',
      models: ['deepseek-chat', 'qwen-plus'],
      cases: [{ input: { text: 'confidential input' }, testCase: { title: 'secret case', requiredOutputPaths: ['summary'] }, privateCase: true }],
    }, { runSkill: runSkill as any })

    expect(result).toMatchObject({
      ok: true,
      models: ['qwen-plus'],
      rejectedModels: ['deepseek-chat'],
      summary: { attempted: 1, succeeded: 1, scored: 1, passed: 1 },
      privacy: {
        scope: 'enterprise_private',
        compatReportWritten: false,
        publicPassportUpdated: false,
        publicLeaderboardUpdated: false,
        inputOutputReturned: false,
      },
    })
    expect(runSkill).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      forceModel: 'qwen-plus',
      benchmark: true,
      skipAggregate: true,
      skipCompatReport: true,
      enterprisePrivateBenchmark: true,
      enterpriseRegistryId: 'reg-1',
    }))
    expect(JSON.stringify(result)).not.toContain('confidential input')
    expect(JSON.stringify(result)).not.toContain('requiredOutputPaths')
  })
})
