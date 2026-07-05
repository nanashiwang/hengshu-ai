import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearPendingAccessToken, metaWithPendingAccessToken, pendingAccessTokenFromMeta } from '@/lib/deviceAuth'

describe('deviceAuth — 设备授权临时 token 加密', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('写入 pending token 时只保留密文，不落旧明文字段', () => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret-32-bytes-long-enough')
    const meta = metaWithPendingAccessToken({ os: 'darwin', pendingAccessToken: 'old' }, 'runner-token')
    expect(meta.os).toBe('darwin')
    expect(meta.pendingAccessToken).toBeUndefined()
    expect(String(meta.pendingAccessTokenEncrypted)).toMatch(/^enc:v1:/)
    expect(String(meta.pendingAccessTokenEncrypted)).not.toContain('runner-token')
    expect(pendingAccessTokenFromMeta(meta)).toBe('runner-token')
  })

  it('生产环境不接受旧明文 pendingAccessToken', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret-32-bytes-long-enough')
    expect(pendingAccessTokenFromMeta({ pendingAccessToken: 'legacy-token' })).toBe('')
  })

  it('消费后清除密文和旧明文', () => {
    const cleaned = clearPendingAccessToken({
      label: 'mac',
      pendingAccessToken: 'legacy',
      pendingAccessTokenEncrypted: 'enc:v1:abc',
    })
    expect(cleaned).toEqual({ label: 'mac' })
  })
})
