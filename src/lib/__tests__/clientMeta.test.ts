import { describe, it, expect, afterEach, vi } from 'vitest'
import { getClientIp, hashDeviceId, hashIp, normalizeDeviceId } from '@/lib/clientMeta'

function h(map: Record<string, string>): Headers {
  const hd = new Headers()
  for (const [k, v] of Object.entries(map)) hd.set(k, v)
  return hd
}

// 反女巫 P0：X-Forwarded-For 最左段可被客户端伪造，必须从右往左取。此测试锁死该行为，防回归。
describe('getClientIp — XFF 从右往左防伪造', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('TRUSTED_PROXY_COUNT=0：取最右段（最近可信对端）', () => {
    vi.stubEnv('TRUSTED_PROXY_COUNT', '0')
    expect(getClientIp(h({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' }))).toBe('3.3.3.3')
  })

  it('TRUSTED_PROXY_COUNT=1：跳过 1 层己方代理，取右起第 2 段', () => {
    vi.stubEnv('TRUSTED_PROXY_COUNT', '1')
    expect(getClientIp(h({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' }))).toBe('2.2.2.2')
  })

  it('伪造无法把最左段顶成客户端 IP', () => {
    vi.stubEnv('TRUSTED_PROXY_COUNT', '0')
    expect(getClientIp(h({ 'x-forwarded-for': 'forged-1.1.1.1, 9.9.9.9' }))).toBe('9.9.9.9')
  })

  it('trusted 超过链长 → clamp 到最左，不越界返回空', () => {
    vi.stubEnv('TRUSTED_PROXY_COUNT', '99')
    expect(getClientIp(h({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('1.1.1.1')
  })

  it('无 XFF 回退 x-real-ip', () => {
    expect(getClientIp(h({ 'x-real-ip': '8.8.8.8' }))).toBe('8.8.8.8')
  })

  it('全无 → 空串', () => {
    expect(getClientIp(h({}))).toBe('')
  })
})

describe('hashIp', () => {
  it('确定性 + 长度 32 + 不含原文（不可逆）', () => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret')
    const a = hashIp('1.2.3.4')
    expect(a).toBe(hashIp('1.2.3.4'))
    expect(a).toHaveLength(32)
    expect(a).not.toContain('1.2.3.4')
    vi.unstubAllEnvs()
  })

  it('不同 IP → 不同哈希', () => {
    expect(hashIp('1.2.3.4')).not.toBe(hashIp('5.6.7.8'))
  })

  it('空 IP → 空串', () => {
    expect(hashIp('')).toBe('')
  })
})

describe('deviceId 规范化与哈希', () => {
  it('只接受 16-128 位短 ASCII token，并会 trim', () => {
    expect(normalizeDeviceId('  0123456789abcdef  ')).toBe('0123456789abcdef')
    expect(normalizeDeviceId('short')).toBe('')
    expect(normalizeDeviceId('含中文0123456789abcdef')).toBe('')
    expect(normalizeDeviceId('x'.repeat(129))).toBe('')
    expect(normalizeDeviceId(null)).toBe('')
  })

  it('hashDeviceId 确定性 + 不含原文；无效输入返回空串', () => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret')
    const id = '018f4e20-8f4b-7b16-a35d-123456789abc'
    const a = hashDeviceId(id)
    expect(a).toBe(hashDeviceId(id))
    expect(a).toHaveLength(32)
    expect(a).not.toContain(id)
    expect(hashDeviceId('short')).toBe('')
    vi.unstubAllEnvs()
  })
})
