import { describe, expect, it } from 'vitest'
import { isPublicScoreSnapshot, publicScoreSnapshotWhere } from '@/lib/scoreSnapshotPublic'

describe('scoreSnapshotPublic — 分数快照公开边界', () => {
  it('公开查询只允许 public/published Skill 的分数快照', () => {
    expect(publicScoreSnapshotWhere()).toEqual({
      and: [
        { 'skill.status': { equals: 'published' } },
        { 'skill.visibility': { equals: 'public' } },
      ],
    })
  })

  it('未展开 Skill 或非公开 Skill 快照不会进入公开验签列表', () => {
    expect(isPublicScoreSnapshot({ skill: { status: 'published', visibility: 'public' } })).toBe(true)
    expect(isPublicScoreSnapshot({ skill: { status: 'published', visibility: 'private' } })).toBe(false)
    expect(isPublicScoreSnapshot({ skill: { status: 'pending', visibility: 'public' } })).toBe(false)
    expect(isPublicScoreSnapshot({ skill: 'skill-1' })).toBe(false)
  })
})
