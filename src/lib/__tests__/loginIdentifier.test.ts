import { describe, expect, it } from 'vitest'
import { loginIdentifierKind, normalizeLoginIdentifier } from '@/lib/loginIdentifier'

describe('loginIdentifier — 邮箱/用户名登录识别', () => {
  it('清理首尾空格', () => {
    expect(normalizeLoginIdentifier('  alice  ')).toBe('alice')
  })

  it('包含 @ 时按邮箱登录', () => {
    expect(loginIdentifierKind('alice@example.com')).toBe('email')
  })

  it('不包含 @ 时按用户名登录', () => {
    expect(loginIdentifierKind('alice')).toBe('username')
  })
})
