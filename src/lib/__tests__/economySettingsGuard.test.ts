import { describe, expect, it } from 'vitest'
import {
  economyMarginReconcileContext,
  guardEconomySettingsUpdate,
} from '@/lib/economySettingsGuard'

describe('economySettingsGuard — 毛利真值只能由对账 worker 写入', () => {
  const original = {
    monthlyRealizedMarginCents: 100,
    marginSource: 'manual',
    marginReconciledAt: null,
  }

  it('阻断管理员手工把毛利来源伪造成 newapi', () => {
    expect(() =>
      guardEconomySettingsUpdate({
        data: { marginSource: 'newapi' },
        originalDoc: original,
      }),
    ).toThrow('只能由 worker:reconcile-newapi 写入')
  })

  it('阻断管理员手工伪造本月对账时间', () => {
    expect(() =>
      guardEconomySettingsUpdate({
        data: { marginReconciledAt: new Date().toISOString() },
        originalDoc: original,
      }),
    ).toThrow('只能由 worker:reconcile-newapi 写入')
  })

  it('管理员手填毛利会强制降级为 manual 并清空对账时间', () => {
    const data = guardEconomySettingsUpdate({
      data: { monthlyRealizedMarginCents: 500 },
      originalDoc: original,
    })
    expect(data).toMatchObject({
      monthlyRealizedMarginCents: 500,
      marginSource: 'manual',
      marginReconciledAt: null,
    })
  })

  it('worker 对账上下文允许写入 newapi/local 真值字段', () => {
    const data = guardEconomySettingsUpdate({
      context: economyMarginReconcileContext(),
      data: {
        monthlyRealizedMarginCents: 500,
        marginSource: 'newapi',
        marginReconciledAt: new Date().toISOString(),
      },
      originalDoc: original,
    })
    expect(data.marginSource).toBe('newapi')
  })

  it('首次初始化 global 时允许安全默认值，不误伤普通经济参数保存', () => {
    const data = guardEconomySettingsUpdate({
      data: {
        exchangeEnabled: false,
        monthlyRealizedMarginCents: 0,
        marginSource: 'manual',
        marginReconciledAt: null,
        pointsPerCredit: 20,
      },
      originalDoc: undefined,
    })
    expect(data.marginSource).toBe('manual')
    expect(data.marginReconciledAt).toBeNull()
    expect(data.pointsPerCredit).toBe(20)
  })

  it('首次初始化也禁止伪造 worker 真值字段', () => {
    expect(() =>
      guardEconomySettingsUpdate({
        data: {
          marginSource: 'newapi',
          marginReconciledAt: new Date().toISOString(),
        },
        originalDoc: undefined,
      }),
    ).toThrow('只能由 worker:reconcile-newapi 写入')
  })
})
