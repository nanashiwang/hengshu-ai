import type { Payload } from 'payload'

function relationId(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'object') return String((value as any).id || '') || null
  return String(value)
}

export function isUsableSkillVersionForPublicEvidence(skill: any, version: any): boolean {
  if (!skill || !version) return false
  const skillId = relationId(skill)
  const versionSkillId = relationId(version.skill)
  if (!skillId || !versionSkillId || skillId !== versionSkillId) return false
  return version.status !== 'deprecated'
}

export async function resolveCurrentSkillVersionForPublicEvidence(payload: Payload, skill: any) {
  const versionId = typeof skill?.currentVersion === 'object' ? skill.currentVersion?.id : skill?.currentVersion
  if (!versionId) return null
  const version = typeof skill.currentVersion === 'object' && skill.currentVersion?.id
    ? skill.currentVersion
    : await payload
        .findByID({ collection: 'skill-versions' as any, id: String(versionId), depth: 0, overrideAccess: true })
        .catch(() => null)
  return isUsableSkillVersionForPublicEvidence(skill, version) ? version : null
}
