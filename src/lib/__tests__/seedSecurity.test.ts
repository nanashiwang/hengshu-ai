import { describe, expect, it } from 'vitest'
import { shouldCreateWelcomeInvite } from '@/seed/security'

describe('seed security — 默认首管/邀请码安全', () => {
  it('生产默认不创建固定 WELCOME1 邀请码，除非显式打开', () => {
    expect(shouldCreateWelcomeInvite({ NODE_ENV: 'production' })).toBe(false)
    expect(shouldCreateWelcomeInvite({ NODE_ENV: 'production', SEED_CREATE_WELCOME_CODE: '1' })).toBe(true)
    expect(shouldCreateWelcomeInvite({ NODE_ENV: 'development' })).toBe(true)
  })
})
