export function runLedgerUrl(skillId?: unknown, model?: unknown, success?: boolean, modelVersion?: unknown) {
  if (!skillId) return '/console/runs'
  const params = new URLSearchParams({ skillId: String(skillId) })
  if (model) params.set('model', String(model))
  if (modelVersion) params.set('modelVersion', String(modelVersion))
  if (success === false) params.set('success', 'false')
  return `/console/runs?${params.toString()}`
}

export function modelProfileUrl(model?: unknown, modelVersion?: unknown) {
  if (!model) return null
  const params = new URLSearchParams({ modelName: String(model) })
  if (modelVersion) params.set('modelVersion', String(modelVersion))
  return `/models?${params.toString()}`
}

export function failureKnowledgeUrl(args: {
  skillId?: unknown
  model?: unknown
  modelVersion?: unknown
  errorCode?: unknown
  success?: boolean
}) {
  if (args.success !== false) return null
  const params = new URLSearchParams()
  if (args.skillId) params.set('skillId', String(args.skillId))
  if (args.model) params.set('modelName', String(args.model))
  if (args.modelVersion) params.set('modelVersion', String(args.modelVersion))
  if (args.errorCode) params.set('errorType', String(args.errorCode))
  const qs = params.toString()
  return qs ? `/failures?${qs}` : '/failures'
}

export function runResultLinks(args: {
  skillId?: unknown
  model?: unknown
  modelVersion?: unknown
  errorCode?: unknown
  success?: boolean
}) {
  return {
    runLedgerUrl: runLedgerUrl(args.skillId, args.model, args.success, args.modelVersion),
    modelProfileUrl: modelProfileUrl(args.model, args.modelVersion),
    failureKnowledgeUrl: failureKnowledgeUrl(args),
  }
}
