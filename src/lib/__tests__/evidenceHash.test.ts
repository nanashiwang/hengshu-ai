import { describe, expect, it } from 'vitest'
import { evidenceHash } from '@/lib/evidenceHash'

describe('evidenceHash — 证据 hash', () => {
  it('对象 key 顺序不同 hash 仍一致', () => {
    expect(evidenceHash({ b: 2, a: 1 })).toBe(evidenceHash({ a: 1, b: 2 }))
    expect(evidenceHash({ a: 1 })).toHaveLength(64)
  })
})
