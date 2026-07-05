import { describe, expect, it } from 'vitest'
import { aggregateByModel, compatLookbackStartISO, COMPAT_LOOKBACK_DAYS } from '@/lib/compat'

describe('compat — 活体数据窗口', () => {
  it('lookback 固定为近 180 天', () => {
    expect(compatLookbackStartISO(new Date('2026-07-03T00:00:00.000Z'))).toBe('2026-01-04T00:00:00.000Z')
    expect(COMPAT_LOOKBACK_DAYS).toBe(180)
  })

  it('按 skill + createdAt 窗口分页读取，避免 5000 条全量同步重算', async () => {
    const calls: any[] = []
    const payload = {
      find: async (args: any) => {
        calls.push(args)
        return {
          docs: [
            {
              modelName: 'deepseek-chat',
              success: true,
              formatValid: true,
              latencyMs: 100,
              source: 'benchmark',
              createdAt: new Date().toISOString(),
            },
          ],
          hasNextPage: false,
        }
      },
    }

    await aggregateByModel(payload as any, 'skill-1')
    expect(calls[0]).toMatchObject({
      collection: 'compat-reports',
      limit: 500,
      sort: 'id',
      where: {
        and: [{ skill: { equals: 'skill-1' } }, { createdAt: { greater_than_equal: expect.any(String) } }],
      },
    })
  })
})
