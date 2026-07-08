import { evidenceVerifyPageUrl } from './evidenceLinks'
import { publicSanitize } from './publicSanitize'

function relationId(value: any): string | null {
  if (!value) return null
  if (typeof value === 'object') return value.id ? String(value.id) : null
  return String(value)
}

function relationSummary(value: any) {
  if (!value) return null
  if (typeof value === 'object') return { id: String(value.id || ''), slug: value.slug || null, title: value.title || value.name || null }
  return { id: String(value), slug: null, title: null }
}

function coverageNumbers(value: any) {
  const coverage = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const targetRuns = Number(coverage.targetRuns || 0)
  const verifiedRuns = Number(coverage.verifiedRuns || 0)
  return {
    targetRuns: Number.isFinite(targetRuns) && targetRuns > 0 ? targetRuns : 3,
    verifiedRuns: Number.isFinite(verifiedRuns) && verifiedRuns > 0 ? verifiedRuns : 0,
    beforeSuccessRate: coverage.beforeSuccessRate ?? null,
    afterSuccessRate: coverage.afterSuccessRate ?? null,
    formatRateAfter: coverage.formatRateAfter ?? null,
  }
}

function adapterSummary(adapter: any) {
  const after = adapter?.afterMetrics && typeof adapter.afterMetrics === 'object' ? adapter.afterMetrics : {}
  return {
    id: String(adapter?.id || ''),
    title: adapter?.title || null,
    modelName: adapter?.modelName || null,
    modelVersion: adapter?.modelVersion || adapter?.modelProfile?.modelVersion || null,
    liftScore: adapter?.liftScore ?? 0,
    afterSamples: Number(after.samples || 0),
    lastVerifiedAt: adapter?.lastVerifiedAt || null,
    evidenceVerifyPageUrl: evidenceVerifyPageUrl('adapter_profile', adapter?.id),
  }
}

function candidateRunSummary(run: any, fallbackModel?: unknown, fallbackVersion?: unknown) {
  const id = String(run?.id || '')
  const model = run?.model || fallbackModel || null
  const modelVersion = run?.modelVersion || fallbackVersion || null
  return {
    id,
    runId: run?.runId || null,
    skill: relationSummary(run?.skill),
    skillVersion: relationSummary(run?.skillVersion),
    model,
    modelVersion,
    errorCode: run?.errorCode || null,
    success: Boolean(run?.success),
    formatValid: Boolean(run?.formatValid),
    latencyMs: run?.latencyMs ?? null,
    createdAt: run?.createdAt || null,
    rerunUrl: id ? `/v1/runs/${encodeURIComponent(id)}/rerun` : null,
    rerunBody: model ? { model, ...(modelVersion ? { modelVersion } : {}) } : null,
  }
}

export function buildFailureReverifyRunWhere(userId: string, failureCase: any) {
  const and: any[] = [
    { user: { equals: userId } },
    { success: { equals: false } },
  ]
  const skillId = relationId(failureCase?.skill)
  if (skillId) and.push({ skill: { equals: skillId } })
  if (failureCase?.modelName) and.push({ model: { equals: String(failureCase.modelName) } })
  if (failureCase?.primaryModelVersion) and.push({ modelVersion: { equals: String(failureCase.primaryModelVersion) } })
  if (failureCase?.errorType) and.push({ errorCode: { equals: String(failureCase.errorType) } })
  return { and }
}

export function buildApprovedAdapterWhere(failureCase: any) {
  const and: any[] = [
    { status: { equals: 'active' } },
    { or: [{ reviewStatus: { equals: 'approved' } }, { reviewStatus: { exists: false } }] },
  ]
  const failureId = relationId(failureCase?.id)
  const skillId = relationId(failureCase?.skill)
  if (failureId) and.push({ sourceFailureCase: { equals: failureId } })
  if (skillId) and.push({ skill: { equals: skillId } })
  if (failureCase?.modelName) and.push({ modelName: { equals: String(failureCase.modelName) } })
  if (failureCase?.primaryModelVersion) {
    and.push({ or: [{ modelVersion: { equals: String(failureCase.primaryModelVersion) } }, { modelVersion: { exists: false } }] })
  }
  return { and }
}

export function buildFailureReverifyPlan(args: { failureCase: any; candidateRuns?: any[]; adapters?: any[]; userId?: string }) {
  const failure = args.failureCase || {}
  const candidateRuns = Array.isArray(args.candidateRuns) ? args.candidateRuns : []
  const adapters = Array.isArray(args.adapters) ? args.adapters : []
  const coverage = coverageNumbers(failure.verificationCoverage)
  const remainingRuns = Math.max(coverage.targetRuns - coverage.verifiedRuns, 0)
  const approvedAdapters = adapters.map(adapterSummary).filter((a) => a.id)
  const decision =
    coverage.verifiedRuns >= coverage.targetRuns && coverage.targetRuns > 0
      ? 'already_verified'
      : approvedAdapters.length > 0 && candidateRuns.length > 0
        ? 'rerun_with_approved_adapter'
        : candidateRuns.length > 0
          ? 'reproduce_then_patch'
          : 'collect_private_failures'

  const modelName = failure.modelName || null
  const modelVersion = failure.primaryModelVersion || null
  const skill = relationSummary(failure.skill)
  const runLedgerUrl = `/console/runs?${new URLSearchParams({
    success: 'false',
    ...(skill?.id ? { skillId: skill.id } : {}),
    ...(modelName ? { model: String(modelName) } : {}),
    ...(modelVersion ? { modelVersion: String(modelVersion) } : {}),
  }).toString()}`

  return publicSanitize({
    customerValue:
      '把失败库从“看见问题”推进到“用自己的历史输入复验修复”：先找同类失败运行，再用同输入重跑，最后把覆盖数写回失败案例。',
    decision,
    failureCase: {
      id: String(failure.id || ''),
      title: failure.title || null,
      errorType: failure.errorType || null,
      skill,
      modelName,
      modelVersion,
      profileKey: failure.profileKey || null,
      primaryInputBucket: failure.primaryInputBucket || null,
    },
    coverage: {
      ...coverage,
      remainingRuns,
      enough: remainingRuns === 0,
    },
    candidateRuns: candidateRuns.slice(0, 10).map((run) => candidateRunSummary(run, modelName, modelVersion)),
    candidateRunCount: candidateRuns.length,
    approvedAdapters,
    nextActions: [
      {
        label: '筛出同类失败运行',
        description: '只按 Skill、模型/版本、错误类型和失败状态匹配，不暴露原始输入输出。',
        href: runLedgerUrl,
      },
      {
        label: approvedAdapters.length ? '用同输入复验已批准 Adapter' : '先复现失败再生成 Adapter',
        description: approvedAdapters.length
          ? '对 candidateRuns 逐条调用 rerunUrl；运行时会命中已批准 active Adapter，再对比成功率和格式率。'
          : '还没有已批准 Adapter，先确认失败可稳定复现，再由作者/审核员生成草稿。',
        href: candidateRuns[0]?.id ? `/v1/runs/${encodeURIComponent(String(candidateRuns[0].id))}/rerun` : runLedgerUrl,
      },
      {
        label: '更新复验覆盖',
        description: '审核员把 targetRuns、verifiedRuns、before/after 成功率和格式率写回 triage，避免只凭单次样例判断。',
        href: failure.id ? `/v1/failures/${encodeURIComponent(String(failure.id))}/triage` : null,
      },
      {
        label: '验签修复证据',
        description: '若复验通过，再查看 Adapter/FailureCase evidenceHash，确认公开证据没有被篡改。',
        href: failure.id ? `/verify?targetType=failure_case&targetId=${encodeURIComponent(String(failure.id))}` : null,
      },
    ],
  })
}
