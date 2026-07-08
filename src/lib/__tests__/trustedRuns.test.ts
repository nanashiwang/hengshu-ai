import { describe, expect, it } from 'vitest'
import { isTrustedCompatibleRun, trustedCompatibleRunWhere } from '@/lib/trustedRuns'

describe('trustedRuns — 北极星可信兼容运行', () => {
  it('构造可计数的可信兼容运行条件', () => {
    expect(trustedCompatibleRunWhere('user-1', { skillId: 'skill-1', versionId: 'version-1' })).toEqual({
      and: [
        { user: { equals: 'user-1' } },
        { skillVersion: { equals: 'version-1' } },
        { skill: { equals: 'skill-1' } },
        { success: { equals: true } },
        { formatValid: { equals: true } },
        { countedInMetrics: { not_equals: false } },
        { modelProfile: { exists: true } },
        { skillVersion: { exists: true } },
        { 'skillVersion.status': { not_equals: 'deprecated' } },
        { 'skill.status': { equals: 'published' } },
        { 'skill.visibility': { equals: 'public' } },
      ],
    })
    expect(trustedCompatibleRunWhere(undefined, { skillId: 'skill-1' }).and[0]).toEqual({
      skill: { equals: 'skill-1' },
    })
  })

  it('只把成功、格式有效、有模型画像、公开已发布 Skill 的运行计为可信兼容', () => {
    const run = {
      success: true,
      formatValid: true,
      countedInMetrics: true,
      modelProfile: 'profile-1',
      skill: { status: 'published', visibility: 'public' },
      skillVersion: { status: 'active' },
    }
    expect(isTrustedCompatibleRun(run)).toBe(true)
    expect(isTrustedCompatibleRun({ ...run, success: false })).toBe(false)
    expect(isTrustedCompatibleRun({ ...run, modelProfile: null })).toBe(false)
    expect(isTrustedCompatibleRun({ ...run, skillVersion: null })).toBe(false)
    expect(isTrustedCompatibleRun({ ...run, skill: { status: 'published', visibility: 'private' } })).toBe(false)
    expect(isTrustedCompatibleRun({ ...run, countedInMetrics: false })).toBe(false)
    expect(isTrustedCompatibleRun({ ...run, skillVersion: { status: 'deprecated' } })).toBe(false)
  })
})
