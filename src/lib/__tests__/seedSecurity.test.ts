import { describe, expect, it } from 'vitest'
import { resolveSeedAdminCredentials, shouldCreateWelcomeInvite } from '@/seed/security'

describe('seed security — 默认首管/邀请码安全', () => {
  it('生产环境禁止无强密码创建默认管理员', () => {
    expect(() => resolveSeedAdminCredentials({ NODE_ENV: 'production' })).toThrow('SEED_ADMIN_PASSWORD')
    expect(() => resolveSeedAdminCredentials({ NODE_ENV: 'production', SEED_ADMIN_PASSWORD: 'short' })).toThrow(
      'SEED_ADMIN_PASSWORD',
    )
  })

  it('显式强密码可用，且不会标记为自动生成', () => {
    expect(
      resolveSeedAdminCredentials({ NODE_ENV: 'production', SEED_ADMIN_EMAIL: 'root@example.com', SEED_ADMIN_PASSWORD: 'strong-pass-123' }),
    ).toEqual({ email: 'root@example.com', password: 'strong-pass-123', generated: false })
  })

  it('开发环境无密码时生成一次性强随机密码', () => {
    const creds = resolveSeedAdminCredentials({ NODE_ENV: 'development' })
    expect(creds.generated).toBe(true)
    expect(creds.password).toHaveLength(27)
    expect(creds.password).toMatch(/^hs_/)
  })

  it('生产默认不创建固定 WELCOME1 邀请码，除非显式打开', () => {
    expect(shouldCreateWelcomeInvite({ NODE_ENV: 'production' })).toBe(false)
    expect(shouldCreateWelcomeInvite({ NODE_ENV: 'production', SEED_CREATE_WELCOME_CODE: '1' })).toBe(true)
    expect(shouldCreateWelcomeInvite({ NODE_ENV: 'development' })).toBe(true)
  })
})
