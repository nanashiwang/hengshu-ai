import type { Where } from 'payload'

export function publicContributionUserWhere(): Where {
  return {
    and: [
      { accountStatus: { equals: 'active' } },
      { contributionScore: { greater_than: 0 } },
    ],
  }
}

export function publicContributionUser(user: any) {
  return {
    id: String(user?.id || ''),
    username: user?.username || '匿名用户',
    level: user?.level ?? 1,
    contributionScore: user?.contributionScore ?? 0,
  }
}
