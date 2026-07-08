import { describe, expect, it } from 'vitest'
import { bountyReadWhere, canAcceptBounty, canReadBounty, canSubmitBounty, canUseSkillAsBountyDelivery } from '@/lib/bountyAccess'

describe('bountyAccess — 悬赏认领边界', () => {
  const user = { id: 'u2', role: 'creator', accountStatus: 'active' }

  it('私有悬赏详情只给发布人、接单人和审核角色读取', () => {
    expect(canReadBounty({ isPublic: true, creator: 'u1' }, null)).toBe(true)
    expect(canReadBounty({ isPublic: false, creator: 'u1', acceptedBy: 'u2' }, null)).toBe(false)
    expect(canReadBounty({ isPublic: false, creator: 'u1', acceptedBy: 'u2' }, user)).toBe(true)
    expect(canReadBounty({ isPublic: false, creator: 'u1', acceptedBy: 'u3' }, user)).toBe(false)
    expect(canReadBounty({ isPublic: false, creator: 'u1' }, { id: 'r1', role: 'reviewer', accountStatus: 'active' })).toBe(true)
  })

  it('集合 read where 与详情可见性使用同一边界', () => {
    expect(bountyReadWhere(null)).toEqual({ isPublic: { equals: true } })
    expect(bountyReadWhere(user)).toEqual({
      or: [
        { isPublic: { equals: true } },
        { creator: { equals: 'u2' } },
        { acceptedBy: { equals: 'u2' } },
      ],
    })
    expect(bountyReadWhere({ id: 'r1', role: 'reviewer', accountStatus: 'active' })).toBe(true)
  })

  it('只允许认领公开开放悬赏', () => {
    expect(canAcceptBounty({ status: 'open', isPublic: true, creator: 'u1' }, user)).toBe(true)
    expect(canAcceptBounty({ status: 'open', isPublic: false, creator: 'u1' }, user)).toBe(false)
    expect(canAcceptBounty({ status: 'accepted', isPublic: true, creator: 'u1' }, user)).toBe(false)
  })

  it('发布人和封禁用户不能认领', () => {
    expect(canAcceptBounty({ status: 'open', isPublic: true, creator: 'u2' }, user)).toBe(false)
    expect(canAcceptBounty({ status: 'open', isPublic: true, creator: 'u1' }, { ...user, accountStatus: 'banned' })).toBe(false)
  })

  it('只有接单人可在 accepted 状态提交交付物', () => {
    expect(canSubmitBounty({ status: 'accepted', acceptedBy: 'u2' }, user)).toBe(true)
    expect(canSubmitBounty({ status: 'open', acceptedBy: 'u2' }, user)).toBe(false)
    expect(canSubmitBounty({ status: 'accepted', acceptedBy: 'u1' }, user)).toBe(false)
  })

  it('交付物必须是本人公开已发布 Skill', () => {
    expect(canUseSkillAsBountyDelivery({ status: 'published', visibility: 'public', author: 'u2' }, user)).toBe(true)
    expect(canUseSkillAsBountyDelivery({ status: 'pending', visibility: 'public', author: 'u2' }, user)).toBe(false)
    expect(canUseSkillAsBountyDelivery({ status: 'published', visibility: 'private', author: 'u2' }, user)).toBe(false)
    expect(canUseSkillAsBountyDelivery({ status: 'published', visibility: 'public', author: 'u1' }, user)).toBe(false)
  })
})
