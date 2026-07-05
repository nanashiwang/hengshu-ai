import { afterEach, describe, expect, it, vi } from 'vitest'
import { anonHash } from '@/lib/compat'
import { compatSuppressionWheresForUser } from '@/lib/moderation'

describe('moderation — 封禁后兼容报告追溯降权', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('同时覆盖 online 用户哈希、Runner 具名报告与 Runner 匿名哈希', () => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret-32-bytes-long-enough')
    const wheres = compatSuppressionWheresForUser('u1', [
      { id: 'runner-doc-1', runnerId: 'runner-runtime-1' },
      { id: 'runner-doc-2' },
    ])

    expect(wheres).toContainEqual({
      and: [{ anonymousUserHash: { equals: anonHash('u1') } }, { source: { equals: 'online' } }],
    })
    expect(wheres).toContainEqual({ runner: { equals: 'runner-doc-1' } })
    expect(wheres).toContainEqual({ anonymousUserHash: { equals: anonHash('runner-runtime-1') } })
    expect(wheres).toContainEqual({ runner: { equals: 'runner-doc-2' } })
  })
})
