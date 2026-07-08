import { describe, expect, it } from 'vitest'
import { publicContributionUser, publicContributionUserWhere } from '@/lib/userPublic'

describe('userPublic — 公开贡献榜用户输出', () => {
  it('公开贡献榜只取 active 且有贡献值的用户', () => {
    expect(publicContributionUserWhere()).toEqual({
      and: [
        { accountStatus: { equals: 'active' } },
        { contributionScore: { greater_than: 0 } },
      ],
    })
  })

  it('公开用户摘要不暴露邮箱、余额或内部身份字段', () => {
    const row = publicContributionUser({
      id: 'u1',
      username: 'alice',
      email: 'alice@example.com',
      level: 3,
      contributionScore: 120,
      creditBalance: 999,
      role: 'admin',
      accountStatus: 'active',
    }) as any

    expect(row).toEqual({
      id: 'u1',
      username: 'alice',
      level: 3,
      contributionScore: 120,
    })
    expect(row.email).toBeUndefined()
    expect(row.creditBalance).toBeUndefined()
    expect(row.role).toBeUndefined()
    expect(row.accountStatus).toBeUndefined()
  })
})
