import { describe, expect, it } from 'vitest'
import { normalizeExternalIdempotencyKey, scopedIdempotencyKey } from '@/lib/idempotency'

describe('idempotency — 外部幂等键规范化与作用域', () => {
  it('只接受 16-128 位短 ASCII token', () => {
    expect(normalizeExternalIdempotencyKey('  0123456789abcdef  ')).toBe('0123456789abcdef')
    expect(normalizeExternalIdempotencyKey('short')).toBe('')
    expect(normalizeExternalIdempotencyKey('中文0123456789abcdef')).toBe('')
    expect(normalizeExternalIdempotencyKey('x'.repeat(129))).toBe('')
  })

  it('按 scope + user 隔离，避免不同用户外部 key 碰撞', () => {
    const a = scopedIdempotencyKey('exchange', 'u1', '0123456789abcdef')
    const b = scopedIdempotencyKey('exchange', 'u2', '0123456789abcdef')
    expect(a).toBe('exchange:u1:0123456789abcdef')
    expect(b).toBe('exchange:u2:0123456789abcdef')
    expect(a).not.toBe(b)
  })

  it('无效外部 key 返回空串', () => {
    expect(scopedIdempotencyKey('exchange', 'u1', 'short')).toBe('')
  })
})
