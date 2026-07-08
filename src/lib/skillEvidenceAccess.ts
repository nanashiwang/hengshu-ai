export function canReadSkillEvidence(skill: any, user?: any) {
  if (!skill) return false
  if (skill.status === 'published' && skill.visibility === 'public') return true
  if (!user || user.accountStatus === 'banned') return false
  if (user.role === 'admin' || user.role === 'reviewer') return true
  const authorId = typeof skill.author === 'object' ? skill.author?.id : skill.author
  return Boolean(authorId && String(authorId) === String(user.id))
}

export function skillPassportEvidenceWhere(skill: any, user?: any) {
  if (!canReadSkillEvidence(skill, user)) return null
  const and: any[] = [{ skill: { equals: skill.id } }]
  if (skill.status === 'published' && skill.visibility === 'public') {
    and.push({ status: { equals: 'current' } })
  } else {
    and.push({ status: { in: ['current', 'draft', 'stale'] } })
  }
  return { and }
}

export function canPreviewSkillRun(skill: any, user?: any) {
  if (!skill || !user || user.accountStatus === 'banned') return false
  if (user.role === 'admin' || user.role === 'reviewer') return true
  const authorId = typeof skill.author === 'object' ? skill.author?.id : skill.author
  return Boolean(authorId && String(authorId) === String(user.id))
}

export function canUsePublishedSkillDirectly(skill: any, user?: any) {
  if (!skill || skill.status !== 'published') return false
  if (skill.visibility === 'public') return true
  return canPreviewSkillRun(skill, user)
}

export function canRerunPrivateLedgerSkill(skill: any, user?: any) {
  // 私人台账保存的是历史输入，不代表 Skill 之后仍可继续被运行。
  // 重跑必须重新经过当前 Skill 可见性边界；enterprise Skill 应走带组织上下文的 Registry 授权链路。
  return canUsePublishedSkillDirectly(skill, user)
}

export function canUseSkillRunEndpoint(skill: any, user: any, organizationId?: string | null) {
  if (!skill || skill.status !== 'published') return { ok: false, status: 403, error: 'Skill 未发布' }
  if (skill.visibility === 'enterprise') {
    if (!organizationId) return { ok: false, status: 403, error: '缺少组织上下文' }
    // 企业 Registry、模型白名单与审计策略在 runSkill 中按组织上下文继续校验。
    return { ok: true }
  }
  if (!canUsePublishedSkillDirectly(skill, user)) {
    return { ok: false, status: 404, error: 'Skill 不存在或无权访问' }
  }
  return { ok: true }
}
