import { describe, expect, it } from 'vitest'
import { isUsableSkillVersionForPublicEvidence, resolveCurrentSkillVersionForPublicEvidence } from '@/lib/skillVersionPublic'

describe('skillVersionPublic — 公开证据版本边界', () => {
  it('只允许当前版本属于该 Skill 且未废弃', () => {
    const skill = { id: 'skill-1' }
    expect(isUsableSkillVersionForPublicEvidence(skill, { id: 'v1', skill: 'skill-1', status: 'active' })).toBe(true)
    expect(isUsableSkillVersionForPublicEvidence(skill, { id: 'v2', skill: 'skill-2', status: 'active' })).toBe(false)
    expect(isUsableSkillVersionForPublicEvidence(skill, { id: 'v3', skill: 'skill-1', status: 'deprecated' })).toBe(false)
    expect(isUsableSkillVersionForPublicEvidence(skill, { id: 'v4', status: 'active' })).toBe(false)
  })

  it('解析 currentVersion 时拒绝跨 Skill 指向', async () => {
    const payload = {
      findByID: async () => ({ id: 'v-other', skill: 'skill-2', status: 'active' }),
    }
    await expect(resolveCurrentSkillVersionForPublicEvidence(payload as any, { id: 'skill-1', currentVersion: 'v-other' })).resolves.toBeNull()
  })

  it('currentVersion 已展开时不重复查询并返回可用版本', async () => {
    const payload = {
      findByID: async () => {
        throw new Error('should not fetch')
      },
    }
    const version = { id: 'v1', skill: 'skill-1', status: 'active' }
    await expect(resolveCurrentSkillVersionForPublicEvidence(payload as any, { id: 'skill-1', currentVersion: version })).resolves.toBe(version)
  })
})
