import { describe, expect, it } from 'vitest'
import { normalizeRegisterCreditAmount, registerCreditIdempotencyKey } from '@/lib/registerCredit'

describe('registerCredit — 注册赠送额度补账基础', () => {
  it('幂等键稳定绑定用户', () => {
    expect(registerCreditIdempotencyKey('u1')).toBe('register:u1')
  })

  it('注册赠送额度只接受非负整数 credit', () => {
    expect(normalizeRegisterCreditAmount(30.8)).toBe(30)
    expect(normalizeRegisterCreditAmount(-5)).toBe(0)
    expect(normalizeRegisterCreditAmount('30')).toBe(0)
  })
})
