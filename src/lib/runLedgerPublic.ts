import { isTrustedCompatibleRun } from './trustedRuns'
import { boundedStringParam } from './queryParams'

export function buildRunLedgerWhere(userId: string, params: URLSearchParams) {
  const skillId = boundedStringParam(params, 'skillId', 160) || boundedStringParam(params, 'skill', 160)
  const model = boundedStringParam(params, 'model', 160)
  const modelVersion = boundedStringParam(params, 'modelVersion', 160)
  const routeMode = boundedStringParam(params, 'routeMode', 40)
  const success = params.get('success')?.trim()
  const formatValid = params.get('formatValid')?.trim()
  const trustedCompatible = params.get('trustedCompatible')?.trim()
  const rerunOf = boundedStringParam(params, 'rerunOf', 160)

  const and: any[] = [{ user: { equals: userId } }]
  if (skillId) and.push({ skill: { equals: skillId } })
  if (model) and.push({ model: { equals: model } })
  if (modelVersion) and.push({ modelVersion: { equals: modelVersion } })
  if (routeMode) and.push({ routeMode: { equals: routeMode } })
  if (success === '1' || success === 'true') and.push({ success: { equals: true } })
  if (success === '0' || success === 'false') and.push({ success: { equals: false } })
  if (formatValid === '1' || formatValid === 'true') and.push({ formatValid: { equals: true } })
  if (formatValid === '0' || formatValid === 'false') and.push({ formatValid: { equals: false } })
  if (trustedCompatible === '1' || trustedCompatible === 'true') {
    and.push({ success: { equals: true } })
    and.push({ formatValid: { equals: true } })
    and.push({ countedInMetrics: { not_equals: false } })
    and.push({ modelProfile: { exists: true } })
    and.push({ skillVersion: { exists: true } })
    and.push({ 'skillVersion.status': { not_equals: 'deprecated' } })
    and.push({ 'skill.status': { equals: 'published' } })
    and.push({ 'skill.visibility': { equals: 'public' } })
  }
  if (rerunOf) and.push({ rerunOf: { equals: rerunOf } })
  return { and }
}


function modelProfileUrl(model: unknown, modelVersion?: unknown) {
  if (!model) return null
  const params = new URLSearchParams({ modelName: String(model) })
  if (modelVersion) params.set('modelVersion', String(modelVersion))
  return `/models?${params.toString()}`
}

function failureKnowledgeUrl(run: any) {
  if (run?.success) return null
  const skill = relationSummary(run?.skill)
  const params = new URLSearchParams()
  if (skill?.id) params.set('skillId', skill.id)
  if (run?.model) params.set('modelName', String(run.model))
  if (run?.modelVersion) params.set('modelVersion', String(run.modelVersion))
  if (run?.errorCode) params.set('errorType', String(run.errorCode))
  const qs = params.toString()
  return qs ? `/failures?${qs}` : '/failures'
}

function relationSummary(value: any) {
  if (!value) return null
  if (typeof value === 'object') return { id: String(value.id || ''), slug: value.slug || null, title: value.title || null }
  return { id: String(value), slug: null, title: null }
}

export function privateRunLedgerEntry(run: any, includeIO = false) {
  return {
    id: String(run?.id || ''),
    runId: run?.runId || null,
    skill: relationSummary(run?.skill),
    skillVersion: relationSummary(run?.skillVersion),
    model: run?.model || null,
    modelVersion: run?.modelVersion || run?.modelProfile?.modelVersion || null,
    modelProfile: relationSummary(run?.modelProfile),
    modelProfileUrl: modelProfileUrl(run?.model, run?.modelVersion || run?.modelProfile?.modelVersion),
    routeMode: run?.routeMode || null,
    success: Boolean(run?.success),
    formatValid: Boolean(run?.formatValid),
    errorCode: run?.errorCode || null,
    failureKnowledgeUrl: failureKnowledgeUrl(run),
    promptTokens: run?.promptTokens ?? null,
    completionTokens: run?.completionTokens ?? null,
    totalTokens: run?.totalTokens ?? null,
    estimatedCost: run?.estimatedCost ?? null,
    chargedAmount: run?.chargedAmount ?? null,
    chargedCredits: run?.chargedCredits ?? 0,
    savedAmount: run?.savedAmount ?? 0,
    latencyMs: run?.latencyMs ?? null,
    rerunOf: relationSummary(run?.rerunOf),
    rerunFromModel: run?.rerunFromModel || null,
    countedInMetrics: run?.countedInMetrics !== false,
    trustedCompatible: isTrustedCompatibleRun(run),
    createdAt: run?.createdAt || null,
    ...(includeIO
      ? {
          inputJson: run?.inputJson ?? null,
          outputText: run?.outputText ?? null,
          outputJson: run?.outputJson ?? null,
        }
      : {}),
  }
}
