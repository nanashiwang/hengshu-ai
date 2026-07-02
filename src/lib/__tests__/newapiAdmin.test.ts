import { describe, it, expect, afterEach, vi } from 'vitest'
import { createNewApiAdmin, isRealMode, subTokenName, NewApiAdminError } from '@/lib/newapiAdmin'

describe('newapiAdmin', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('未配置 env → stub 模式，方法模拟成功', async () => {
    vi.stubEnv('NEWAPI_ADMIN_BASE_URL', '')
    vi.stubEnv('NEWAPI_ADMIN_KEY', '')
    expect(isRealMode()).toBe(false)
    const a = createNewApiAdmin()
    expect(a.mode).toBe('stub')
    expect(await a.provisionSubToken('u1')).toEqual({ tokenName: 'hs_u1', simulated: true })
    expect(await a.adjustQuota('u1', 100)).toEqual({ ok: true, simulated: true })
    const usage = await a.fetchUsage('u1', 0)
    expect(usage.simulated).toBe(true)
    expect(usage.costCents).toBe(0)
  })

  it('配置 env → real 模式，方法在接入 curl 前抛 NotImplemented', async () => {
    vi.stubEnv('NEWAPI_ADMIN_BASE_URL', 'https://relay.example.com')
    vi.stubEnv('NEWAPI_ADMIN_KEY', 'sk-admin')
    expect(isRealMode()).toBe(true)
    const a = createNewApiAdmin()
    expect(a.mode).toBe('real')
    await expect(a.provisionSubToken('u1')).rejects.toBeInstanceOf(NewApiAdminError)
    await expect(a.adjustQuota('u1', 1)).rejects.toBeInstanceOf(NewApiAdminError)
    await expect(a.fetchUsage('u1', 0)).rejects.toBeInstanceOf(NewApiAdminError)
  })

  it('子令牌命名约定 hs_<userId>', () => {
    expect(subTokenName('abc-123')).toBe('hs_abc-123')
  })
})
