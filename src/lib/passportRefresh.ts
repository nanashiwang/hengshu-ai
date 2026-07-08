import type { Payload } from 'payload'
import { aggregateByModel } from './compat'
import { buildSkillPassportData, upsertSkillPassport } from './passport'
import { resolveCurrentSkillVersionForPublicEvidence } from './skillVersionPublic'
import { trustedCompatibleRunWhere } from './trustedRuns'

async function latestArtifact(payload: Payload, versionId?: string) {
  if (!versionId) return null
  const res = await payload.find({
    collection: 'skill-artifacts' as any,
    where: { and: [{ skillVersion: { equals: versionId } }, { format: { equals: 'yaml' } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    sort: '-createdAt',
  }).catch(() => ({ docs: [] as any[] }))
  return (res.docs as any[])[0] || null
}

export async function refreshSkillPassport(payload: Payload, skillId: string) {
  const skill = await payload.findByID({
    collection: 'skills' as any,
    id: skillId,
    depth: 1,
    overrideAccess: true,
  }).catch(() => null) as any
  if (!skill) return null

  const version = await resolveCurrentSkillVersionForPublicEvidence(payload, skill)
  if (!version?.id) return null

  const [artifact, compat, trustedCompatibleRuns] = await Promise.all([
    latestArtifact(payload, String(version.id)),
    aggregateByModel(payload, String(skill.id)),
    payload.count({
      collection: 'skill-runs' as any,
      where: trustedCompatibleRunWhere(undefined, { skillId: String(skill.id), versionId: String(version.id) }),
      overrideAccess: true,
    }).catch(() => ({ totalDocs: 0 })),
  ])
  const data = buildSkillPassportData({
    skill,
    version,
    artifact,
    compat,
    trustedCompatibleRunCount: trustedCompatibleRuns.totalDocs,
  })
  if (!data.skill) return null
  return upsertSkillPassport(payload, data)
}
