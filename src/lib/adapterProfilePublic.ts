import { publicSanitize } from './publicSanitize'
import { evidenceVerifyApiUrl, evidenceVerifyPageUrl } from './evidenceLinks'
import { boundedStringParam } from './queryParams'

function isPublicSkillRelation(value: any) {
  if (!value || typeof value !== 'object') return false
  return value.status === 'published' && value.visibility === 'public'
}

export function isPublicAdapterProfile(adapter: any) {
  return Boolean(adapter && adapter.status === 'active' && isPublicSkillRelation(adapter.skill))
}

export function buildAdapterProfileWhere(params: URLSearchParams) {
  const skillId = boundedStringParam(params, 'skillId', 160) || boundedStringParam(params, 'skill', 160)
  const modelName = boundedStringParam(params, 'modelName', 160)
  const modelVersion = boundedStringParam(params, 'modelVersion', 160)
  // Public API only exposes active adapters; review/draft workflows must use admin-only endpoints.
  const status = 'active'
  const failureType = boundedStringParam(params, 'failureType', 80)
  const sourceFailureCase = boundedStringParam(params, 'sourceFailureCase', 160) || boundedStringParam(params, 'failureId', 160)
  const modelProfile = boundedStringParam(params, 'modelProfile', 160)

  const and: any[] = []
  and.push({ status: { equals: status } })
  and.push({ 'skill.status': { equals: 'published' } })
  and.push({ 'skill.visibility': { equals: 'public' } })
  if (skillId) and.push({ skill: { equals: skillId } })
  if (modelName) and.push({ modelName: { equals: modelName } })
  if (modelVersion) {
    and.push({
      or: [
        { modelVersion: { equals: modelVersion } },
        { 'modelProfile.modelVersion': { equals: modelVersion } },
      ],
    })
  }
  if (failureType) and.push({ failureTypes: { contains: failureType } })
  if (sourceFailureCase) and.push({ sourceFailureCase: { equals: sourceFailureCase } })
  if (modelProfile) and.push({ modelProfile: { equals: modelProfile } })
  return and.length ? { and } : undefined
}

function relationSummary(value: any) {
  if (!value) return null
  if (typeof value === 'object')
    return {
      id: String(value.id || ''),
      slug: value.slug || null,
      title: value.title || value.modelName || null,
      modelVersion: value.modelVersion || null,
      provider: value.provider || null,
    }
  return { id: String(value), slug: null, title: null }
}

export function publicAdapterProfile(adapter: any) {
  const skill = isPublicSkillRelation(adapter?.skill) ? relationSummary(adapter?.skill) : null
  return {
    id: String(adapter?.id || ''),
    title: adapter?.title || null,
    skill,
    skillVersion: relationSummary(adapter?.skillVersion),
    sourceFailureCase: relationSummary(adapter?.sourceFailureCase),
    modelProfile: relationSummary(adapter?.modelProfile),
    modelName: adapter?.modelName || null,
    modelVersion: adapter?.modelVersion || adapter?.modelProfile?.modelVersion || null,
    status: adapter?.status || 'draft',
    failureTypes: Array.isArray(adapter?.failureTypes) ? adapter.failureTypes : [],
    liftScore: adapter?.liftScore ?? 0,
    beforeMetrics: publicSanitize(adapter?.beforeMetrics || null),
    afterMetrics: publicSanitize(adapter?.afterMetrics || null),
    evidenceHash: adapter?.evidenceHash || null,
    evidenceVerifyUrl: evidenceVerifyApiUrl('adapter_profile', adapter?.id),
    evidenceVerifyPageUrl: evidenceVerifyPageUrl('adapter_profile', adapter?.id),
    lastVerifiedAt: adapter?.lastVerifiedAt || null,
  }
}
