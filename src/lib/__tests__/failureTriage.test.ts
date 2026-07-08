import { describe, expect, it } from 'vitest'
import { bulkTriageFailureCases, normalizeFailureTriageRequest } from '@/lib/failureTriage'

describe('failureTriage — FailureCase 批量确认', () => {
  it('规范化批量归因请求并限制最多 100 个去重 ID', () => {
    const ids = Array.from({ length: 130 }, (_, i) => `failure-${i % 110}`)
    const req = normalizeFailureTriageRequest({
      ids,
      triageStatus: 'attributed',
      rootCauseCategory: 'schema_mismatch',
      triageNotes: 'x'.repeat(1200),
      verificationCoverage: { targetRuns: '3', verifiedRuns: 1, rawInput: 'secret' },
    })

    expect(req).toMatchObject({ ok: true, triageStatus: 'attributed', rootCauseCategory: 'schema_mismatch', failureStatus: 'confirmed' })
    if (req.ok) {
      expect(req.ids).toHaveLength(100)
      expect(req.triageNotes).toHaveLength(1000)
      expect(req.verificationCoverage).toEqual({ targetRuns: 3, verifiedRuns: 1 })
    }
    expect(normalizeFailureTriageRequest({ ids: ['f1'], triageStatus: 'bad' })).toEqual({ ok: false, reason: 'triageStatus 不合法' })
    expect(normalizeFailureTriageRequest({ ids: ['f1'], triageStatus: 'attributed', rootCauseCategory: 'bad' })).toEqual({ ok: false, reason: 'rootCauseCategory 不合法' })
  })

  it('审核员可批量确认 FailureCase，返回部分失败且不回显备注原文', async () => {
    const updates: any[] = []
    const payload = {
      findByID: async ({ id }: any) => (id === 'missing' ? null : { id, status: 'observed', triageStatus: 'pending' }),
      update: async (args: any) => {
        updates.push(args)
        return { id: args.id, ...args.data, triagedAt: '2026-07-08T00:00:00.000Z' }
      },
    }

    const result = await bulkTriageFailureCases(payload as any, {
      ids: ['failure-1', 'missing', 'failure-2'],
      triageStatus: 'attributed',
      rootCauseCategory: 'prompt_boundary',
      triageNotes: '内部归因备注，不应出现在响应里',
      verificationCoverage: { targetRuns: 3, verifiedRuns: 2, beforeSuccessRate: 0.1, afterSuccessRate: 0.7 },
      failureStatus: 'confirmed',
    })

    expect(result).toMatchObject({
      ok: false,
      total: 3,
      updated: 2,
      failed: 1,
      customerValue: expect.stringContaining('批量确认 FailureCase'),
    })
    expect(updates).toHaveLength(2)
    expect(updates[0]).toMatchObject({
      collection: 'failure-cases',
      id: 'failure-1',
      data: {
        triageStatus: 'attributed',
        status: 'confirmed',
        rootCauseCategory: 'prompt_boundary',
        triageNotes: '内部归因备注，不应出现在响应里',
        verificationCoverage: { targetRuns: 3, verifiedRuns: 2, beforeSuccessRate: 0.1, afterSuccessRate: 0.7 },
      },
    })
    expect(result.results).toContainEqual({ id: 'missing', ok: false, error: '失败案例不存在' })
    expect(JSON.stringify(result)).not.toContain('内部归因备注')
  })
})
