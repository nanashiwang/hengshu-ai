import { afterEach, describe, it, expect, vi } from 'vitest'
import type { EconomyConfig } from '@/lib/economy'
import { exchangePoolTotal, getEconomyConfig, monthStartISO, dayStartISO } from '@/lib/economy'

const cfg = (over: Partial<EconomyConfig> = {}): EconomyConfig => ({
  exchangeEnabled: true,
  freeCreditOnRegister: 0,
  alpha: 0.3,
  monthlyRealizedMarginCents: 0,
  marginSource: 'manual',
  marginReconciledAt: undefined,
  pointsPerCredit: 10,
  minCreditPerTx: 10,
  perTxMaxCredit: 500,
  perUserDailyMaxCredit: 1000,
  perUserMonthlyMaxCredit: 5000,
  ...over,
})

describe('exchangePoolTotal — 池 = floor(α×毛利分)，永不亏 margin', () => {
  it('正常：0.3×1000 = 300', () => {
    expect(exchangePoolTotal(cfg({ alpha: 0.3, monthlyRealizedMarginCents: 1000 }))).toBe(300)
  })
  it('向下取整', () => {
    expect(exchangePoolTotal(cfg({ alpha: 0.33, monthlyRealizedMarginCents: 1000 }))).toBe(330)
    expect(exchangePoolTotal(cfg({ alpha: 0.3, monthlyRealizedMarginCents: 999 }))).toBe(299)
  })
  it('α=0 或毛利=0 → 池空', () => {
    expect(exchangePoolTotal(cfg({ alpha: 0, monthlyRealizedMarginCents: 1000 }))).toBe(0)
    expect(exchangePoolTotal(cfg({ alpha: 0.3, monthlyRealizedMarginCents: 0 }))).toBe(0)
  })
  it('负毛利 → Math.max(0) 兜成空池（不为负）', () => {
    expect(exchangePoolTotal(cfg({ alpha: 0.3, monthlyRealizedMarginCents: -5000 }))).toBe(0)
  })
})

describe('时间窗起点（TZ 无关不变量）', () => {
  it('monthStartISO：当月 1 号本地 0 点', () => {
    const ms = new Date(monthStartISO(new Date('2026-07-15T10:30:00')))
    expect(ms.getDate()).toBe(1)
    expect(ms.getHours()).toBe(0)
    expect(ms.getMinutes()).toBe(0)
  })
  it('dayStartISO：当日本地 0 点', () => {
    const src = new Date('2026-07-15T10:30:00')
    const ds = new Date(dayStartISO(src))
    expect(ds.getDate()).toBe(src.getDate())
    expect(ds.getHours()).toBe(0)
    expect(ds.getMinutes()).toBe(0)
  })
})

describe('getEconomyConfig — 兑换开关必须有本月机器对账毛利', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const payloadWithGlobal = (global: Record<string, unknown>) =>
    ({
      findGlobal: async () => global,
    }) as any

  const oldReconcileAt = () => {
    const d = new Date(monthStartISO())
    d.setMonth(d.getMonth() - 1)
    return d.toISOString()
  }

  it('管理员手填毛利不能打开兑换', async () => {
    const got = await getEconomyConfig(
      payloadWithGlobal({
        exchangeEnabled: true,
        monthlyRealizedMarginCents: 10000,
        marginSource: 'manual',
        marginReconciledAt: new Date().toISOString(),
      }),
    )
    expect(got.exchangeEnabled).toBe(false)
  })

  it('旧月份对账不能打开兑换', async () => {
    const got = await getEconomyConfig(
      payloadWithGlobal({
        exchangeEnabled: true,
        monthlyRealizedMarginCents: 10000,
        marginSource: 'newapi',
        marginReconciledAt: oldReconcileAt(),
      }),
    )
    expect(got.exchangeEnabled).toBe(false)
  })

  it('未来对账时间不能打开兑换，避免一次未来时间让旧毛利长期有效', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const got = await getEconomyConfig(
      payloadWithGlobal({
        exchangeEnabled: true,
        monthlyRealizedMarginCents: 10000,
        marginSource: 'newapi',
        marginReconciledAt: future,
      }),
    )
    expect(got.exchangeEnabled).toBe(false)
  })

  it('本月 newapi 对账后允许兑换开关生效', async () => {
    const got = await getEconomyConfig(
      payloadWithGlobal({
        exchangeEnabled: true,
        monthlyRealizedMarginCents: 10000,
        marginSource: 'newapi',
        marginReconciledAt: new Date().toISOString(),
      }),
    )
    expect(got.exchangeEnabled).toBe(true)
  })

  it('local 估算必须切到 local 来源并显式确认才允许兑换开关生效', async () => {
    const base = {
      exchangeEnabled: true,
      monthlyRealizedMarginCents: 10000,
      marginSource: 'local',
      marginReconciledAt: new Date().toISOString(),
    }

    expect((await getEconomyConfig(payloadWithGlobal(base))).exchangeEnabled).toBe(false)

    vi.stubEnv('ALLOW_LOCAL_MARGIN_EXCHANGE', '1')
    expect((await getEconomyConfig(payloadWithGlobal(base))).exchangeEnabled).toBe(false)

    vi.stubEnv('NEWAPI_USAGE_SOURCE', 'local')
    expect((await getEconomyConfig(payloadWithGlobal(base))).exchangeEnabled).toBe(true)
  })
})
