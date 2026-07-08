import { describe, expect, it } from 'vitest'
import { normalizeAdapterReviewRequest, reviewAdapters } from '@/lib/adapterReview'

describe('adapterReview — Adapter 批量评审', () => {
  it('规范化批量评审请求并限制最多 100 个去重 ID', () => {
    const ids = Array.from({ length: 120 }, (_, i) => `adapter-${i % 110}`)
    const req = normalizeAdapterReviewRequest({
      ids,
      reviewStatus: 'approved',
      activate: true,
      reviewerNotes: 'x'.repeat(1200),
    })

    expect(req).toMatchObject({ ok: true, reviewStatus: 'approved', activate: true })
    if (req.ok) {
      expect(req.ids).toHaveLength(100)
      expect(req.reviewerNotes).toHaveLength(1000)
    }
    expect(normalizeAdapterReviewRequest({ ids: ['a'], reviewStatus: 'rejected', activate: true })).toEqual({
      ok: false,
      reason: '只有 approved 可以启用 Adapter',
    })
  })

  it('批量批准时逐条启用，并返回部分失败结果', async () => {
    const updates: any[] = []
    const payload = {
      findByID: async ({ id }: any) => (id === 'missing' ? null : { id, status: 'draft', reviewStatus: 'pending' }),
      update: async (args: any) => {
        updates.push(args)
        return { id: args.id, ...args.data, reviewedAt: '2026-07-08T00:00:00.000Z' }
      },
    }

    const result = await reviewAdapters(payload as any, {
      ids: ['a1', 'missing', 'a2'],
      reviewStatus: 'approved',
      activate: true,
      reviewerNotes: '批量确认',
    })

    expect(result).toMatchObject({
      ok: false,
      total: 3,
      updated: 2,
      approved: 2,
      failed: 1,
      customerValue: expect.stringContaining('一次性处理多个 Adapter'),
    })
    expect(updates).toHaveLength(2)
    expect(updates[0]).toMatchObject({
      collection: 'adapter-profiles',
      id: 'a1',
      data: { reviewStatus: 'approved', status: 'active', reviewerNotes: '批量确认' },
    })
    expect(result.results).toContainEqual({ id: 'missing', ok: false, error: 'Adapter 不存在' })
  })

  it('批准启用 Adapter 后自动把同类私人失败运行放入复验队列', async () => {
    const enqueued: any[] = []
    const updates: any[] = []
    const payload = {
      findByID: async (args: any) => {
        if (args.collection === 'adapter-profiles') {
          return {
            id: args.id,
            status: 'draft',
            reviewStatus: 'pending',
            skill: 'skill-1',
            sourceFailureCase: 'failure-1',
            modelName: 'qwen-plus',
            modelVersion: '2026-07-01',
          }
        }
        if (args.collection === 'failure-cases') {
          return {
            id: 'failure-1',
            skill: 'skill-1',
            errorType: 'json_parse_error',
            modelName: 'qwen-plus',
            primaryModelVersion: '2026-07-01',
          }
        }
        return null
      },
      find: async (args: any) => {
        if (args.collection === 'skill-runs') {
          expect(args.where.and).toEqual(expect.arrayContaining([
            { skill: { equals: 'skill-1' } },
            { success: { equals: false } },
            { adapterProfile: { exists: false } },
            { model: { equals: 'qwen-plus' } },
            { modelVersion: { equals: '2026-07-01' } },
            { errorCode: { equals: 'json_parse_error' } },
          ]))
          return {
            docs: [
              { id: 'run-1', user: 'user-1' },
              { id: 'run-2', user: { id: 'user-1' } },
              { id: 'run-3', user: 'user-2' },
              { id: 'run-no-user' },
            ],
          }
        }
        if (args.collection === 'compat-reports') return { docs: [] }
        return { docs: [] }
      },
      update: async (args: any) => {
        updates.push(args)
        if (args.data.beforeMetrics || args.data.afterMetrics) return { id: args.id, ...args.data }
        return {
          id: args.id,
          ...args.data,
          skill: 'skill-1',
          sourceFailureCase: 'failure-1',
          modelName: 'qwen-plus',
          modelVersion: '2026-07-01',
          reviewedAt: '2026-07-08T00:00:00.000Z',
        }
      },
    }

    const result = await reviewAdapters(payload as any, {
      ids: ['adapter-1'],
      reviewStatus: 'approved',
      activate: true,
      enqueueReverify: async (_payload, job) => {
        enqueued.push(job)
        return { enqueued: true }
      },
    })

    expect(result).toMatchObject({
      ok: true,
      approved: 1,
      autoReverify: { queued: 2, candidateRuns: 3, adapters: 1 },
      results: [
        expect.objectContaining({
          id: 'adapter-1',
          autoReverify: expect.objectContaining({
            status: 'queued',
            failureCaseId: 'failure-1',
            candidateRuns: 3,
            userJobs: 2,
            enqueued: 2,
          }),
        }),
      ],
    })
    expect(enqueued).toEqual([
      expect.objectContaining({ failureCaseId: 'failure-1', userId: 'user-1', candidateRunIds: ['run-1', 'run-2'], adapterIds: ['adapter-1'], reason: 'adapter_approved' }),
      expect.objectContaining({ failureCaseId: 'failure-1', userId: 'user-2', candidateRunIds: ['run-3'], adapterIds: ['adapter-1'], reason: 'adapter_approved' }),
    ])
    expect(updates[0]).toMatchObject({ data: { reviewStatus: 'approved', status: 'active' } })
    expect(updates[1]).toMatchObject({ data: { beforeMetrics: expect.any(Object), afterMetrics: expect.any(Object), liftScore: 0 } })
  })
})
