import { describe, expect, it } from 'vitest'
import { boundedIntParam, boundedStringParam } from '@/lib/queryParams'

describe('queryParams — GET 查询参数边界', () => {
  it('boundedIntParam 对 NaN/空值使用默认值，并做上下限钳制', () => {
    expect(boundedIntParam(new URLSearchParams('limit=abc'), 'limit', 50, 1, 200)).toBe(50)
    expect(boundedIntParam(new URLSearchParams('limit='), 'limit', 50, 1, 200)).toBe(50)
    expect(boundedIntParam(new URLSearchParams('limit=-5'), 'limit', 50, 1, 200)).toBe(1)
    expect(boundedIntParam(new URLSearchParams('limit=999'), 'limit', 50, 1, 200)).toBe(200)
    expect(boundedIntParam(new URLSearchParams('limit=12.9'), 'limit', 50, 1, 200)).toBe(12)
  })

  it('boundedStringParam trim 并截断超长查询值', () => {
    expect(boundedStringParam(new URLSearchParams('q=%20hello%20'), 'q', 10)).toBe('hello')
    expect(boundedStringParam(new URLSearchParams(`q=${'x'.repeat(20)}`), 'q', 8)).toBe('x'.repeat(8))
    expect(boundedStringParam(new URLSearchParams(''), 'q', 8)).toBe('')
  })
})
