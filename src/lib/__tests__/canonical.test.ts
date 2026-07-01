import { describe, it, expect } from 'vitest'
import { sortKeys, canonicalString } from '@/lib/canonical'

// 规范化是 checksum 与 ed25519 签名的共同基座——key 顺序无关性一旦破坏，验签会在跨端全面失败。
describe('canonical', () => {
  it('key 顺序无关：不同插入顺序产生相同规范串', () => {
    const a = { b: 1, a: 2, c: { y: 1, x: 2 } }
    const b = { c: { x: 2, y: 1 }, a: 2, b: 1 }
    expect(canonicalString(a)).toBe(canonicalString(b))
  })

  it('数组顺序敏感（元素顺序不被排序）', () => {
    expect(canonicalString({ a: [1, 2, 3] })).not.toBe(canonicalString({ a: [3, 2, 1] }))
  })

  it('数组内对象的 key 仍被递归排序', () => {
    expect(canonicalString({ a: [{ y: 1, x: 2 }] })).toBe('{"a":[{"x":2,"y":1}]}')
  })

  it('原始值原样返回', () => {
    expect(sortKeys(5)).toBe(5)
    expect(sortKeys('x')).toBe('x')
    expect(sortKeys(null)).toBe(null)
  })
})
