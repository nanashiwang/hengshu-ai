import { describe, expect, it } from 'vitest'
import {
  canPreviewSkillRun,
  canReadSkillEvidence,
  canRerunPrivateLedgerSkill,
  canUsePublishedSkillDirectly,
  canUseSkillRunEndpoint,
  skillPassportEvidenceWhere,
} from '@/lib/skillEvidenceAccess'

describe('skillEvidenceAccess', () => {
  it('公开已发布 Skill 的证据可匿名读取', () => {
    expect(canReadSkillEvidence({ status: 'published', visibility: 'public' }, null)).toBe(true)
  })

  it('已发布但非 public 的 Skill 不对匿名公开详情或证据', () => {
    expect(canReadSkillEvidence({ status: 'published', visibility: 'private', author: 'u1' }, null)).toBe(false)
    expect(canReadSkillEvidence({ status: 'published', visibility: 'unlisted', author: 'u1' }, null)).toBe(false)
    expect(canReadSkillEvidence({ status: 'published', visibility: 'enterprise', author: 'u1' }, null)).toBe(false)
  })

  it('待审 Skill 证据仅作者或全站审核角色可预览', () => {
    const skill = { status: 'pending', visibility: 'public', author: 'u1' }
    expect(canReadSkillEvidence(skill, null)).toBe(false)
    expect(canReadSkillEvidence(skill, { id: 'u2', role: 'creator' })).toBe(false)
    expect(canReadSkillEvidence(skill, { id: 'u1', role: 'creator' })).toBe(true)
    expect(canReadSkillEvidence(skill, { id: 'reviewer-1', role: 'reviewer' })).toBe(true)
    expect(canReadSkillEvidence(skill, { id: 'ent-1', role: 'enterprise_admin' })).toBe(false)
  })

  it('封禁作者不能预览私有证据', () => {
    expect(
      canReadSkillEvidence(
        { status: 'pending', visibility: 'public', author: 'u1' },
        { id: 'u1', role: 'creator', accountStatus: 'banned' },
      ),
    ).toBe(false)
  })

  it('公开已发布 Skill 的 Passport API 只读 current，避免把 draft/stale 当正式证据公开', () => {
    expect(skillPassportEvidenceWhere({ id: 'skill-1', status: 'published', visibility: 'public' }, null)).toEqual({
      and: [{ skill: { equals: 'skill-1' } }, { status: { equals: 'current' } }],
    })
  })

  it('待审作者预览可读 current/draft/stale，但不读 revoked', () => {
    expect(
      skillPassportEvidenceWhere(
        { id: 'skill-1', status: 'pending', visibility: 'public', author: 'u1' },
        { id: 'u1', role: 'creator' },
      ),
    ).toEqual({
      and: [{ skill: { equals: 'skill-1' } }, { status: { in: ['current', 'draft', 'stale'] } }],
    })
  })

  it('运行端点可直接运行 public，非 public 仅作者/审核可预览，企业成员需走 Registry 授权', () => {
    const user = { id: 'u1', role: 'creator', accountStatus: 'active' }
    const other = { id: 'u2', role: 'creator', accountStatus: 'active' }
    const enterpriseAdmin = { id: 'e1', role: 'enterprise_admin', accountStatus: 'active' }

    expect(canUsePublishedSkillDirectly({ status: 'published', visibility: 'public' }, other)).toBe(true)
    expect(canUsePublishedSkillDirectly({ status: 'published', visibility: 'private', author: 'u1' }, user)).toBe(true)
    expect(canUsePublishedSkillDirectly({ status: 'published', visibility: 'private', author: 'u1' }, other)).toBe(false)
    expect(canUsePublishedSkillDirectly({ status: 'published', visibility: 'enterprise', author: 'u1' }, enterpriseAdmin)).toBe(false)
    expect(canPreviewSkillRun({ status: 'published', visibility: 'enterprise', author: 'u1' }, enterpriseAdmin)).toBe(false)
  })

  it('私人台账换模型重跑也必须重新经过当前 Skill 可见性边界', () => {
    const owner = { id: 'u1', role: 'creator', accountStatus: 'active' }
    const other = { id: 'u2', role: 'user', accountStatus: 'active' }

    expect(canRerunPrivateLedgerSkill({ status: 'published', visibility: 'public' }, other)).toBe(true)
    expect(canRerunPrivateLedgerSkill({ status: 'published', visibility: 'private', author: 'u1' }, owner)).toBe(true)
    expect(canRerunPrivateLedgerSkill({ status: 'published', visibility: 'private', author: 'u1' }, other)).toBe(false)
    expect(canRerunPrivateLedgerSkill({ status: 'archived', visibility: 'public', author: 'u1' }, owner)).toBe(false)
    expect(canRerunPrivateLedgerSkill({ status: 'published', visibility: 'enterprise', author: 'u1' }, other)).toBe(false)
  })

  it('organizationId 不能绕过 private/unlisted Skill 的运行权限', () => {
    const owner = { id: 'u1', role: 'creator', accountStatus: 'active' }
    const other = { id: 'u2', role: 'user', accountStatus: 'active' }
    const privateSkill = { status: 'published', visibility: 'private', author: 'u1' }
    const enterpriseSkill = { status: 'published', visibility: 'enterprise', author: 'u1' }

    expect(canUseSkillRunEndpoint(privateSkill, other, 'org-1')).toEqual({
      ok: false,
      status: 404,
      error: 'Skill 不存在或无权访问',
    })
    expect(canUseSkillRunEndpoint(privateSkill, owner, 'org-1')).toEqual({ ok: true })
    expect(canUseSkillRunEndpoint(enterpriseSkill, other, null)).toEqual({
      ok: false,
      status: 403,
      error: '缺少组织上下文',
    })
    expect(canUseSkillRunEndpoint(enterpriseSkill, other, 'org-1')).toEqual({ ok: true })
  })
})
