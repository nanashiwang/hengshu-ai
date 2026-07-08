import { describe, expect, it } from 'vitest'
import { buildRunLedgerWhere, privateRunLedgerEntry } from '@/lib/runLedgerPublic'

describe('runLedgerPublic — 私人运行台账导出', () => {
  it('构造本人私有台账筛选条件', () => {
    const params = new URLSearchParams({
      skillId: 'skill-1',
      model: 'qwen-plus',
      modelVersion: '2026-07-01',
      routeMode: 'balanced',
      success: 'true',
      formatValid: 'true',
      trustedCompatible: 'true',
      rerunOf: 'run-0',
    })
    expect(buildRunLedgerWhere('user-1', params)).toEqual({
      and: [
        { user: { equals: 'user-1' } },
        { skill: { equals: 'skill-1' } },
        { model: { equals: 'qwen-plus' } },
        { modelVersion: { equals: '2026-07-01' } },
        { routeMode: { equals: 'balanced' } },
        { success: { equals: true } },
        { formatValid: { equals: true } },
        { success: { equals: true } },
        { formatValid: { equals: true } },
        { countedInMetrics: { not_equals: false } },
        { modelProfile: { exists: true } },
        { skillVersion: { exists: true } },
        { 'skillVersion.status': { not_equals: 'deprecated' } },
        { 'skill.status': { equals: 'published' } },
        { 'skill.visibility': { equals: 'public' } },
        { rerunOf: { equals: 'run-0' } },
      ],
    })
  })

  it('截断私人台账筛选中的超长字符串', () => {
    const where = buildRunLedgerWhere('u1', new URLSearchParams({
      skillId: 's'.repeat(200),
      model: 'm'.repeat(200),
      modelVersion: 'v'.repeat(200),
      rerunOf: 'r'.repeat(200),
    })) as any
    expect(where.and).toContainEqual({ skill: { equals: 's'.repeat(160) } })
    expect(where.and).toContainEqual({ model: { equals: 'm'.repeat(160) } })
    expect(where.and).toContainEqual({ modelVersion: { equals: 'v'.repeat(160) } })
    expect(where.and).toContainEqual({ rerunOf: { equals: 'r'.repeat(160) } })
  })

  const run = {
    id: 'run-1',
    runId: 'r_1',
    skill: { id: 'skill-1', slug: 'writer', title: 'Writer', status: 'published', visibility: 'public' },
    modelProfile: { id: 'profile-1', title: 'qwen-plus' },
    skillVersion: { id: 'version-1', status: 'active' },
    model: 'qwen-plus',
    modelVersion: '2026-07-01',
    success: false,
    errorCode: 'json_parse_error',
    estimatedCost: 0.01,
    savedAmount: 0.02,
    inputJson: { topic: 'secret' },
    outputText: 'private output',
    outputJson: { ok: true },
    user: 'user-1',
    newapiLogId: 'internal-log',
  }

  it('默认导出账本指标但不含输入输出原文', () => {
    const row = privateRunLedgerEntry(run) as any
    expect(row).toMatchObject({
      id: 'run-1',
      skill: { slug: 'writer' },
      model: 'qwen-plus',
      modelVersion: '2026-07-01',
      modelProfile: { id: 'profile-1' },
      modelProfileUrl: '/models?modelName=qwen-plus&modelVersion=2026-07-01',
      failureKnowledgeUrl: '/failures?skillId=skill-1&modelName=qwen-plus&modelVersion=2026-07-01&errorType=json_parse_error',
      savedAmount: 0.02,
      playbook: {
        customerValue: expect.stringContaining('你的历史输入'),
        rerunUrl: '/v1/runs/run-1/rerun',
        nextActions: expect.arrayContaining([
          expect.objectContaining({ label: '用同一输入换模型重跑' }),
          expect.objectContaining({ label: '对比成本、延迟和成功状态' }),
          expect.objectContaining({
            label: '失败时查失败库',
            href: '/failures?skillId=skill-1&modelName=qwen-plus&modelVersion=2026-07-01&errorType=json_parse_error',
          }),
          expect.objectContaining({ label: '沉淀私人证据' }),
        ]),
      },
    })
    expect(row.inputJson).toBeUndefined()
    expect(row.outputText).toBeUndefined()
    expect(row.newapiLogId).toBeUndefined()
    expect(row.user).toBeUndefined()
    expect(row.trustedCompatible).toBe(false)
  })



  it('成功运行不生成失败库入口', () => {
    const row = privateRunLedgerEntry({ ...run, success: true, formatValid: true }) as any
    expect(row.modelProfileUrl).toBe('/models?modelName=qwen-plus&modelVersion=2026-07-01')
    expect(row.failureKnowledgeUrl).toBeNull()
    expect(row.trustedCompatible).toBe(true)
  })

  it('includeIO 仅由本人导出时可包含输入输出', () => {
    const row = privateRunLedgerEntry(run, true) as any
    expect(row.inputJson).toEqual({ topic: 'secret' })
    expect(row.outputText).toBe('private output')
    expect(row.outputJson).toEqual({ ok: true })
  })
})
