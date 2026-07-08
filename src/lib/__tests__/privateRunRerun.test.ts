import { describe, expect, it, vi } from 'vitest'
import {
  MAX_BULK_RERUN_IDS,
  normalizeBulkPrivateRerunRequest,
  publicBulkRerunItem,
  rerunPrivateLedgerRun,
  statusForRunSkillResult,
} from '@/lib/privateRunRerun'

describe('privateRunRerun — 私人台账批量重跑', () => {
  it('规范化批量重跑请求并限制数量', () => {
    expect(normalizeBulkPrivateRerunRequest({
      ids: [' run-1 ', 'run-1', 'run-2'],
      model: ' qwen-plus ',
      modelVersion: ' 2026-07-01 ',
    })).toEqual({
      ok: true,
      ids: ['run-1', 'run-2'],
      model: 'qwen-plus',
      modelVersion: '2026-07-01',
    })

    expect(normalizeBulkPrivateRerunRequest({
      ids: Array.from({ length: MAX_BULK_RERUN_IDS + 1 }, (_, i) => `run-${i}`),
      model: 'qwen-plus',
    })).toEqual({
      ok: false,
      status: 413,
      error: `一次最多重跑 ${MAX_BULK_RERUN_IDS} 条`,
    })
  })

  it('批量摘要不回显输出正文', () => {
    const item = publicBulkRerunItem('source-1', {
      status: 200,
      sourceRunId: 'source-1',
      body: {
        ok: true,
        runId: 'run-new',
        output: 'secret output',
        outputJson: { secret: true },
        model: 'qwen-plus',
        cost: 0.01,
        chargedCredits: 1,
        savedAmount: 0.02,
        latencyMs: 123,
        formatValid: true,
      },
    })
    expect(item).toMatchObject({
      sourceRunId: 'source-1',
      ok: true,
      runId: 'run-new',
      model: 'qwen-plus',
      cost: 0.01,
      savedAmount: 0.02,
    })
    expect(JSON.stringify(item)).not.toContain('secret output')
  })

  it('沿用单条重跑状态码口径', () => {
    expect(statusForRunSkillResult({ ok: true, runId: 'r' })).toBe(200)
    expect(statusForRunSkillResult({ ok: false, runId: 'r', errorCode: 'INSUFFICIENT_CREDIT' })).toBe(402)
    expect(statusForRunSkillResult({ ok: false, runId: 'r', errorCode: 'RATE_LIMITED' })).toBe(429)
  })

  it('只允许本人台账，重跑时写入 rerunOf 血缘', async () => {
    const run = {
      id: 'source-1',
      user: 'user-1',
      skill: 'skill-1',
      skillVersion: 'version-1',
      model: 'deepseek-chat',
      inputJson: { text: 'private input' },
    }
    const skill = { id: 'skill-1', status: 'published', visibility: 'public', title: 'Skill' }
    const version = { id: 'version-1', skill: 'skill-1', status: 'active', promptTemplate: '{{text}}' }
    const payload = {
      findByID: vi.fn(async (args: any) => {
        if (args.collection === 'skill-runs') return run
        if (args.collection === 'skills') return skill
        if (args.collection === 'skill-versions') return version
        return null
      }),
    }
    const runSkill = vi.fn(async () => ({
      ok: true,
      runId: 'new-run',
      skillRunId: 'new-skill-run',
      model: 'qwen-plus',
    }))

    const result = await rerunPrivateLedgerRun(payload as any, {
      user: { id: 'user-1' },
      sourceRunId: 'source-1',
      model: 'qwen-plus',
      userApiKey: undefined,
    }, { runSkill: runSkill as any })

    expect(result).toMatchObject({ status: 200, body: { ok: true, runId: 'new-run' } })
    expect(runSkill).toHaveBeenCalledWith(expect.objectContaining({
      input: { text: 'private input' },
      forceModel: 'qwen-plus',
      rerunOf: 'source-1',
      rerunFromModel: 'deepseek-chat',
    }))

    const denied = await rerunPrivateLedgerRun(payload as any, {
      user: { id: 'other-user' },
      sourceRunId: 'source-1',
      model: 'qwen-plus',
    }, { runSkill: runSkill as any })
    expect(denied).toMatchObject({ status: 403, body: { error: '只能重跑自己的运行' } })
  })
})
