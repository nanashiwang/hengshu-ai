import { describe, it, expect } from 'vitest'
import { bucketSize, anonHash } from '@/lib/compat'

// 隐私：回传规模只用分档而非精确长度，档位边界不能漂。
describe('bucketSize', () => {
  it('分档边界正确', () => {
    expect(bucketSize(0)).toBe('0-100')
    expect(bucketSize(99)).toBe('0-100')
    expect(bucketSize(100)).toBe('100-500')
    expect(bucketSize(499)).toBe('100-500')
    expect(bucketSize(500)).toBe('500-2k')
    expect(bucketSize(1999)).toBe('500-2k')
    expect(bucketSize(2000)).toBe('2k-8k')
    expect(bucketSize(7999)).toBe('2k-8k')
    expect(bucketSize(8000)).toBe('8k+')
    expect(bucketSize(999999)).toBe('8k+')
  })

  it('NaN/负数归 0 档（不崩溃）', () => {
    expect(bucketSize(NaN)).toBe('0-100')
    expect(bucketSize(-5)).toBe('0-100')
  })
})

describe('anonHash', () => {
  it('确定性 + 长度 32 + 不含原文（不可逆向到 user）', () => {
    const a = anonHash('runner-abc')
    expect(a).toBe(anonHash('runner-abc'))
    expect(a).toHaveLength(32)
    expect(a).not.toContain('runner-abc')
  })

  it('不同 runnerId → 不同哈希', () => {
    expect(anonHash('a')).not.toBe(anonHash('b'))
  })
})
