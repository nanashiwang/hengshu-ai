import { describe, expect, it } from 'vitest'
import { buildFailureCaseWhere } from '@/lib/failureCasePublic'

const publicSkillBoundary = {
  or: [
    { skill: { exists: false } },
    {
      and: [
        { 'skill.status': { equals: 'published' } },
        { 'skill.visibility': { equals: 'public' } },
      ],
    },
  ],
}

describe('failures route — 失败库过滤条件', () => {
  it('支持按 Skill/Profile/输入档/来源过滤脱敏失败画像', () => {
    const params = new URLSearchParams({
      skillId: 'skill-1',
      profileKey: 'skill-1|500-2k|json_parse_error',
      inputBucket: '500-2k',
      source: 'benchmark',
      status: 'confirmed',
    })
    expect(buildFailureCaseWhere(params)).toEqual({
      and: [
        { status: { equals: 'confirmed' } },
        publicSkillBoundary,
        { skill: { equals: 'skill-1' } },
        { profileKey: { equals: 'skill-1|500-2k|json_parse_error' } },
        { inputBuckets: { contains: '500-2k' } },
        { 'sourceBreakdown.benchmark': { greater_than: 0 } },
      ],
    })
  })

  it('没有过滤条件时仍只公开可复用状态，避免暴露已忽略内部失败', () => {
    expect(buildFailureCaseWhere(new URLSearchParams())).toEqual({
      and: [{ status: { in: ['observed', 'confirmed', 'fixed'] } }, publicSkillBoundary],
    })
  })

  it('公开 API 不允许用 status=ignored 绕过状态边界', () => {
    expect(buildFailureCaseWhere(new URLSearchParams({ status: 'ignored' }))).toEqual({
      and: [{ status: { in: ['observed', 'confirmed', 'fixed'] } }, publicSkillBoundary],
    })
  })
})
