
import { publicSanitize } from './publicSanitize'
import { evidenceVerifyApiUrl, evidenceVerifyPageUrl } from './evidenceLinks'
import { boundedStringParam } from './queryParams'

export const PUBLIC_FAILURE_STATUSES = ['observed', 'confirmed', 'fixed'] as const
const PUBLIC_FAILURE_STATUS_SET = new Set(PUBLIC_FAILURE_STATUSES)

function isPublicSkillRelation(value: any) {
  if (!value) return true
  if (typeof value !== 'object') return false
  return value.status === 'published' && value.visibility === 'public'
}

export function isPublicFailureCase(row: any) {
  return Boolean(
    row &&
    PUBLIC_FAILURE_STATUS_SET.has(String(row.status || 'observed') as any) &&
    isPublicSkillRelation(row.skill),
  )
}

export function buildFailureCaseWhere(params: URLSearchParams) {
  const errorType = boundedStringParam(params, 'errorType', 80)
  const modelName = boundedStringParam(params, 'modelName', 160)
  const modelVersion = boundedStringParam(params, 'modelVersion', 160)
  const status = params.get('status')?.trim()
  const skillId = boundedStringParam(params, 'skillId', 160) || boundedStringParam(params, 'skill', 160)
  const profileKey = boundedStringParam(params, 'profileKey', 200)
  const inputBucket = boundedStringParam(params, 'inputBucket', 32)
  const source = boundedStringParam(params, 'source', 40).replace(/[^\w.-]/g, '')

  const and: any[] = []
  and.push(
    PUBLIC_FAILURE_STATUSES.includes(status as any)
      ? { status: { equals: status } }
      : { status: { in: [...PUBLIC_FAILURE_STATUSES] } },
  )
  and.push({
    or: [
      { skill: { exists: false } },
      {
        and: [
          { 'skill.status': { equals: 'published' } },
          { 'skill.visibility': { equals: 'public' } },
        ],
      },
    ],
  })
  if (errorType) and.push({ errorType: { equals: errorType } })
  if (modelName) and.push({ modelName: { equals: modelName } })
  if (modelVersion) and.push({ modelVersions: { contains: modelVersion } })
  if (skillId) and.push({ skill: { equals: skillId } })
  if (profileKey) and.push({ profileKey: { equals: profileKey } })
  if (inputBucket) and.push({ inputBuckets: { contains: inputBucket } })
  if (source) and.push({ [`sourceBreakdown.${source}`]: { greater_than: 0 } })
  return and.length ? { and } : undefined
}

function relationSummary(value: any) {
  if (!value) return null
  if (typeof value === 'object') {
    return {
      id: String(value.id || ''),
      slug: value.slug || null,
      title: value.title || value.name || null,
    }
  }
  return { id: String(value), slug: null, title: null }
}

function modelProfileUrl(modelName: unknown, modelVersion?: unknown) {
  if (!modelName) return null
  const params = new URLSearchParams({ modelName: String(modelName) })
  if (modelVersion) params.set('modelVersion', String(modelVersion))
  return `/models?${params.toString()}`
}

function adaptersUrl(row: any) {
  if (!row?.modelName || !row?.id) return null
  const params = new URLSearchParams({
    modelName: String(row.modelName),
    failureId: String(row.id),
  })
  if (row.primaryModelVersion) params.set('modelVersion', String(row.primaryModelVersion))
  return `/v1/adapters?${params.toString()}`
}

function objectOrEmpty(value: any) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function publicFailureCase(row: any) {
  const skill = isPublicSkillRelation(row?.skill) ? relationSummary(row?.skill) : null
  return {
    id: String(row?.id || ''),
    title: row?.title || null,
    profileKey: row?.profileKey || null,
    errorType: row?.errorType || null,
    modelName: row?.modelName || null,
    primaryModelVersion: row?.primaryModelVersion || null,
    modelProfileUrl: modelProfileUrl(row?.modelName, row?.primaryModelVersion),
    adaptersUrl: adaptersUrl(row),
    skill,
    symptom: row?.symptom || null,
    likelyCause: row?.likelyCause || null,
    hasRepairTemplate: Boolean(row?.repairTemplate),
    hasVerifyTemplate: Boolean(row?.verifyTemplate),
    primaryInputBucket: row?.primaryInputBucket || null,
    inputBuckets: Array.isArray(row?.inputBuckets) ? row.inputBuckets : [],
    outputBuckets: Array.isArray(row?.outputBuckets) ? row.outputBuckets : [],
    modelBreakdown: publicSanitize(objectOrEmpty(row?.modelBreakdown)),
    modelVersions: Array.isArray(row?.modelVersions) ? row.modelVersions : [],
    modelVersionBreakdown: publicSanitize(objectOrEmpty(row?.modelVersionBreakdown)),
    sourceBreakdown: publicSanitize(objectOrEmpty(row?.sourceBreakdown)),
    evidenceHash: row?.evidenceHash || null,
    evidenceVerifyUrl: evidenceVerifyApiUrl('failure_case', row?.id),
    evidenceVerifyPageUrl: evidenceVerifyPageUrl('failure_case', row?.id),
    occurrenceCount: row?.occurrenceCount || 0,
    affectedSkillCount: row?.affectedSkillCount || 0,
    status: row?.status || 'observed',
    lastObservedAt: row?.lastObservedAt || null,
  }
}
