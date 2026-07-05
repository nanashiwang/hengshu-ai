import { afterEach, describe, expect, it, vi } from 'vitest'
import { allowLegacyRunnerTokenAuth, runnerFromBearer, runnerTokenHash } from '@/lib/runnerAuth'

function req(token = 'runner-secret') {
  return new Request('http://local.test', { headers: { Authorization: `Bearer ${token}` } })
}

describe('runnerAuth — Runner token 哈希鉴权', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('生产环境默认只按 tokenHash 查询，不接受旧明文字段', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret-32-bytes-long-enough')
    const find = vi.fn(async (_args: any) => ({ docs: [] }))
    const payload = { find } as any

    expect(allowLegacyRunnerTokenAuth()).toBe(false)
    await expect(runnerFromBearer(payload, req())).resolves.toBeNull()
    expect(find.mock.calls[0][0].where).toEqual({
      tokenHash: { equals: runnerTokenHash('runner-secret') },
    })
  })

  it('迁移期显式允许旧明文 token 时会自愈为 hash 并清空明文', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret-32-bytes-long-enough')
    vi.stubEnv('ALLOW_LEGACY_RUNNER_TOKEN_AUTH', '1')
    const update = vi.fn(async () => undefined)
    const payload = {
      find: vi.fn(async () => ({
        docs: [{ id: 'r1', user: 'u1', token: 'runner-secret' }],
      })),
      findByID: vi.fn(async () => ({ id: 'u1', accountStatus: 'active' })),
      update,
      logger: { error: vi.fn() },
    } as any

    const actor = await runnerFromBearer(payload, req())
    expect(actor?.user.id).toBe('u1')
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'runner-clients',
        id: 'r1',
        data: expect.objectContaining({
          tokenHash: runnerTokenHash('runner-secret'),
          token: null,
        }),
      }),
    )
  })
})
