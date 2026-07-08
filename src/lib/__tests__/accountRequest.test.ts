import { describe, expect, it } from 'vitest'
import {
  MAX_BYOK_KEY_LENGTH,
  MAX_NOTIFICATION_ID_LENGTH,
  MAX_RECHARGE_CODE_LENGTH,
  normalizeExchangeCredit,
  normalizeNotificationId,
  normalizeRechargeCodeInput,
  normalizeUserSettings,
} from '@/lib/accountRequest'

describe('accountRequest — 账户/经济请求边界', () => {
  it('兑换 credit 必须是正整数', () => {
    expect(normalizeExchangeCredit('12.9')).toBe(12)
    expect(normalizeExchangeCredit(0)).toEqual({ ok: false, status: 400, error: '请填写有效的兑换 credit 数' })
    expect(normalizeExchangeCredit('bad')).toEqual({ ok: false, status: 400, error: '请填写有效的兑换 credit 数' })
  })

  it('充值码必填且限长', () => {
    expect(normalizeRechargeCodeInput(' code ')).toBe('code')
    expect(normalizeRechargeCodeInput('')).toEqual({ ok: false, status: 400, error: '请输入充值码' })
    expect(normalizeRechargeCodeInput('x'.repeat(MAX_RECHARGE_CODE_LENGTH + 1))).toEqual({
      ok: false,
      status: 400,
      error: '充值码过长',
    })
  })

  it('用户设置只接受受控字段并限长', () => {
    expect(normalizeUserSettings({ newapiKey: ' sk-test ', bio: 'hi', role: 'admin' })).toEqual({
      newapiKey: 'sk-test',
      bio: 'hi',
    })
    expect(normalizeUserSettings({ newapiKey: 'x'.repeat(MAX_BYOK_KEY_LENGTH + 1) })).toEqual({
      ok: false,
      status: 400,
      error: 'newapiKey 过长',
    })
  })

  it('通知 id 可选但限长', () => {
    expect(normalizeNotificationId(undefined)).toBeUndefined()
    expect(normalizeNotificationId(' n1 ')).toBe('n1')
    expect(normalizeNotificationId('x'.repeat(MAX_NOTIFICATION_ID_LENGTH + 1))).toEqual({
      ok: false,
      status: 400,
      error: '通知 ID 过长',
    })
  })
})
