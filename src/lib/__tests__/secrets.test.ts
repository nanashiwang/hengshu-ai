import { afterEach, describe, expect, it, vi } from 'vitest'
import { decryptJsonSecret, decryptSecret, encryptJsonSecret, encryptSecret, hmacDigest, serverSecret } from '@/lib/secrets'
import { runnerTokenHash } from '@/lib/runnerAuth'
import { normalizeNewApiKeyForStorage } from '@/lib/userSecrets'

describe('secrets — 敏感数据加密/哈希', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('BYOK 加密后不含明文，且可解密', () => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret-32-bytes-long-enough')
    const enc = encryptSecret('sk-user-secret')
    expect(enc).toMatch(/^enc:v1:/)
    expect(enc).not.toContain('sk-user-secret')
    expect(decryptSecret(enc)).toBe('sk-user-secret')
  })


  it('JSON 加密后不含敏感字段，且可还原对象', () => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret-32-bytes-long-enough')
    const enc = encryptJsonSecret({ topic: '私密 prompt', nested: { n: 1 } }) as any
    expect(enc.__enc).toMatch(/^enc:v1:/)
    expect(JSON.stringify(enc)).not.toContain('私密 prompt')
    expect(decryptJsonSecret(enc)).toEqual({ topic: '私密 prompt', nested: { n: 1 } })
  })

  it('JSON 解密兼容历史明文对象', () => {
    const plain = { topic: 'legacy' }
    expect(decryptJsonSecret(plain)).toBe(plain)
  })

  it('兼容历史明文 BYOK', () => {
    expect(decryptSecret('sk-legacy')).toBe('sk-legacy')
  })

  it('用户 BYOK 字段直写明文时统一转为密文，避免绕过 settings route', () => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret-32-bytes-long-enough')
    const stored = normalizeNewApiKeyForStorage(' sk-direct-write ')
    expect(stored).toMatch(/^enc:v1:/)
    expect(stored).not.toContain('sk-direct-write')
    expect(decryptSecret(stored)).toBe('sk-direct-write')
  })

  it('用户 BYOK 字段存储归一化保持密文幂等，并拒绝伪造密文', () => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret-32-bytes-long-enough')
    const stored = encryptSecret('sk-user-secret')
    expect(normalizeNewApiKeyForStorage(stored)).toBe(stored)
    expect(normalizeNewApiKeyForStorage('')).toBeNull()
    expect(normalizeNewApiKeyForStorage(undefined)).toBeUndefined()
    expect(() => normalizeNewApiKeyForStorage('enc:v1:not.valid.ciphertext')).toThrow('无效的模型网关 Key 密文')
  })

  it('生产环境缺 PAYLOAD_SECRET 直接失败，防固定盐上线', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('PAYLOAD_SECRET', '')
    expect(() => serverSecret()).toThrow(/PAYLOAD_SECRET/)
  })

  it('HMAC/Runner token hash 不泄露原文', () => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret-32-bytes-long-enough')
    const h = hmacDigest('raw-token', 'purpose')
    expect(h).toHaveLength(64)
    expect(h).not.toContain('raw-token')
    expect(runnerTokenHash('runner-token')).toHaveLength(64)
    expect(runnerTokenHash('runner-token')).not.toContain('runner-token')
  })
})
