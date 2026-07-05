import { describe, expect, it, vi } from 'vitest'
import {
  dequeueBenchmarkJobWithClient,
  enqueueBenchmarkJobWithClient,
  releaseBenchmarkDedupeWithClient,
} from '@/lib/benchmarkQueue'

function fakeRedis() {
  const store = new Map<string, string>()
  const queue: string[] = []
  return {
    set: vi.fn(async (key: string, value: string, opts?: { NX?: boolean }) => {
      if (opts?.NX && store.has(key)) return null
      store.set(key, value)
      return 'OK'
    }),
    rPush: vi.fn(async (_key: string, value: string) => {
      queue.push(value)
      return queue.length
    }),
    lPop: vi.fn(async () => queue.shift() || null),
    del: vi.fn(async (key: string) => {
      store.delete(key)
      return 1
    }),
  }
}

describe('benchmarkQueue — 发布即评测队列', () => {
  it('入队使用 SET NX 去重，避免发布钩子重复烧钱', async () => {
    const redis = fakeRedis()
    const job = { skillId: 's1', slug: 'demo', enqueuedAt: '2026-07-03T00:00:00.000Z', reason: 'published' as const }

    await expect(enqueueBenchmarkJobWithClient(redis, job)).resolves.toEqual({ enqueued: true })
    await expect(enqueueBenchmarkJobWithClient(redis, job)).resolves.toEqual({
      enqueued: false,
      reason: 'duplicate',
    })
    expect(redis.rPush).toHaveBeenCalledTimes(1)
  })

  it('出队只接受合法 JSON job', async () => {
    const redis = fakeRedis()
    await enqueueBenchmarkJobWithClient(redis, {
      skillId: 's1',
      slug: 'demo',
      enqueuedAt: '2026-07-03T00:00:00.000Z',
      reason: 'published',
    })

    await expect(dequeueBenchmarkJobWithClient(redis)).resolves.toMatchObject({
      skillId: 's1',
      reason: 'published',
    })
    await expect(dequeueBenchmarkJobWithClient(redis)).resolves.toBeNull()
  })

  it('失败释放去重后可重新入队', async () => {
    const redis = fakeRedis()
    const job = { skillId: 's1', enqueuedAt: '2026-07-03T00:00:00.000Z', reason: 'published' as const }

    await enqueueBenchmarkJobWithClient(redis, job)
    await releaseBenchmarkDedupeWithClient(redis, 's1')
    await expect(enqueueBenchmarkJobWithClient(redis, job)).resolves.toEqual({ enqueued: true })
    expect(redis.rPush).toHaveBeenCalledTimes(2)
  })
})
