import { describe, expect, it } from 'vitest'
import { RechargeCodes } from '@/collections/RechargeCodes'
import { maskRechargeCode, normalizeRechargeCode, rechargeCodeDigest, resolveRechargeCreditAmount } from '@/lib/rechargeCodes'

describe('rechargeCodes — 充值码不明文落库', () => {
  it('规范化大小写并忽略空格/横线', () => {
    expect(normalizeRechargeCode(' abcd-1234 ef ')).toBe('ABCD1234EF')
  })

  it('HMAC 对等价输入稳定一致，且不包含明文', () => {
    const a = rechargeCodeDigest('abcd-1234')
    const b = rechargeCodeDigest(' ABCD 1234 ')
    expect(a).toBe(b)
    expect(a).toHaveLength(64)
    expect(a).not.toContain('ABCD')
  })

  it('展示码只保留前后缀', () => {
    expect(maskRechargeCode('abcd-1234-efgh')).toBe('ABCD****EFGH')
  })

  it('充值码金额最多 2 位小数，不得被 floor 静默少发', () => {
    expect(resolveRechargeCreditAmount('12.34')).toBe(12.34)
    expect(() => resolveRechargeCreditAmount('12.345')).toThrow('最多保留 2 位小数')
    expect(() => resolveRechargeCreditAmount(0)).toThrow('非 0 有限数字')
  })

  it('创建充值码必须用明文 code 生成 HMAC，不能直接塞 hash 或预置使用记录', () => {
    const beforeValidate = RechargeCodes.hooks?.beforeValidate?.[0] as any
    const beforeChange = RechargeCodes.hooks?.beforeChange?.[0] as any

    expect(() =>
      beforeValidate({
        operation: 'create',
        data: { codeHash: rechargeCodeDigest('MANUAL'), creditAmount: 10 },
      }),
    ).toThrow('必须填写明文 code')

    const normalized = beforeValidate({
      operation: 'create',
      data: { code: 'abcd-1234', codeHash: 'tampered', codePreview: 'tampered', creditAmount: 10 },
    })
    expect(normalized.code).toBeUndefined()
    expect(normalized.codeHash).toBe(rechargeCodeDigest('ABCD1234'))
    expect(normalized.codePreview).toBe(maskRechargeCode('ABCD1234'))

    expect(() =>
      beforeChange({
        operation: 'create',
        data: { status: 'used', creditAmount: 10 },
        context: {},
      }),
    ).toThrow('只能是 unused')
    expect(() =>
      beforeChange({
        operation: 'create',
        data: { usedBy: 'u1', creditAmount: 10 },
        context: {},
      }),
    ).toThrow('不能预置使用记录')
    expect(beforeChange({ operation: 'create', data: { creditAmount: 10.25 }, context: {} })).toEqual({
      creditAmount: 10.25,
      status: 'unused',
    })
  })

  it('后台不能删除或篡改充值码金额/哈希/使用记录，只能禁用未使用码', async () => {
    const admin = { id: 'admin', role: 'admin', accountStatus: 'active' }
    expect((RechargeCodes.access?.delete as any)({ req: { user: admin } })).toBe(false)

    const beforeChange = RechargeCodes.hooks?.beforeChange?.[0] as any
    expect(() =>
      beforeChange({
        operation: 'update',
        data: { creditAmount: 999 },
        originalDoc: { status: 'unused' },
        context: {},
      }),
    ).toThrow('不可后台修改')
    expect(() =>
      beforeChange({
        operation: 'update',
        data: { usedBy: 'u1' },
        originalDoc: { status: 'unused' },
        context: {},
      }),
    ).toThrow('不可后台修改')
    expect(() =>
      beforeChange({
        operation: 'update',
        data: { status: 'unused' },
        originalDoc: { status: 'used' },
        context: {},
      }),
    ).toThrow('不可回滚')
    expect(
      beforeChange({
        operation: 'update',
        data: { status: 'disabled' },
        originalDoc: { status: 'unused' },
        context: {},
      }),
    ).toEqual({ status: 'disabled' })
  })

  it('充值端服务上下文可标记充值码已使用', async () => {
    const beforeChange = RechargeCodes.hooks?.beforeChange?.[0] as any
    expect(
      beforeChange({
        operation: 'update',
        data: { status: 'used', usedBy: 'u1', usedAt: '2026-07-03T00:00:00.000Z' },
        originalDoc: { status: 'unused' },
        context: { allowRechargeCodeServiceUpdate: true },
      }),
    ).toEqual({ status: 'used', usedBy: 'u1', usedAt: '2026-07-03T00:00:00.000Z' })
  })
})
