import type { Payload } from 'payload'
import { publicSanitize } from './publicSanitize'

export const FAILURE_TRIAGE_STATUSES = new Set(['pending', 'attributed', 'needs_more_evidence', 'verified'])
export const FAILURE_ROOT_CAUSES = new Set(['model_drift', 'prompt_boundary', 'schema_mismatch', 'adapter_gap', 'data_quality', 'unknown'])
export const FAILURE_REVIEWER_ROLES = new Set(['admin', 'reviewer'])
export const FAILURE_PUBLIC_STATUSES = new Set(['observed', 'confirmed', 'fixed', 'ignored'])

export function cleanFailureVerificationCoverage(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  const out: Record<string, number> = {}
  for (const key of ['targetRuns', 'verifiedRuns', 'beforeSuccessRate', 'afterSuccessRate', 'formatRateAfter']) {
    const n = Number(input[key])
    if (Number.isFinite(n)) out[key] = n
  }
  return Object.keys(out).length ? out : undefined
}

function cleanIds(values: unknown[]): string[] {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].slice(0, 100)
}

export function normalizeFailureTriageRequest(body: any):
  | {
      ok: true
      ids: string[]
      triageStatus: string
      rootCauseCategory?: string
      triageNotes?: string
      verificationCoverage?: Record<string, number>
      failureStatus?: string
    }
  | { ok: false; reason: string } {
  const ids = cleanIds(Array.isArray(body?.ids) ? body.ids : body?.id ? [body.id] : [])
  if (!ids.length) return { ok: false, reason: '缺少 FailureCase ids' }
  const triageStatus = String(body?.triageStatus || '').trim()
  if (!FAILURE_TRIAGE_STATUSES.has(triageStatus)) return { ok: false, reason: 'triageStatus 不合法' }
  const rootCauseCategory = body?.rootCauseCategory ? String(body.rootCauseCategory).trim() : undefined
  if (rootCauseCategory && !FAILURE_ROOT_CAUSES.has(rootCauseCategory)) return { ok: false, reason: 'rootCauseCategory 不合法' }
  const failureStatus = body?.failureStatus || body?.status
    ? String(body.failureStatus || body.status).trim()
    : triageStatus === 'attributed' || triageStatus === 'verified'
      ? 'confirmed'
      : undefined
  if (failureStatus && !FAILURE_PUBLIC_STATUSES.has(failureStatus)) return { ok: false, reason: 'failureStatus 不合法' }
  const triageNotes = typeof body?.triageNotes === 'string' ? body.triageNotes.trim().slice(0, 1000) : undefined
  const verificationCoverage = cleanFailureVerificationCoverage(body?.verificationCoverage)
  return { ok: true, ids, triageStatus, rootCauseCategory, triageNotes, verificationCoverage, failureStatus }
}

function failureTriageSummary(row: any, fallback: { triageStatus: string; rootCauseCategory?: string; failureStatus?: string }) {
  return publicSanitize({
    id: String(row?.id || ''),
    status: row?.status || fallback.failureStatus || 'observed',
    triageStatus: row?.triageStatus || fallback.triageStatus,
    rootCauseCategory: row?.rootCauseCategory || fallback.rootCauseCategory || null,
    triagedAt: row?.triagedAt || null,
    verificationCoverage: cleanFailureVerificationCoverage(row?.verificationCoverage) || null,
  })
}

export async function bulkTriageFailureCases(
  payload: Payload,
  args: {
    ids: string[]
    triageStatus: string
    rootCauseCategory?: string
    triageNotes?: string
    verificationCoverage?: Record<string, number>
    failureStatus?: string
  },
) {
  const normalized = normalizeFailureTriageRequest(args)
  if (!normalized.ok) return { ok: false, reason: normalized.reason }
  const results: Array<{ id: string; ok: boolean; failure?: any; error?: string }> = []
  for (const id of normalized.ids) {
    const failure = await payload.findByID({ collection: 'failure-cases' as any, id, depth: 0, overrideAccess: true }).catch(() => null)
    if (!failure) {
      results.push({ id, ok: false, error: '失败案例不存在' })
      continue
    }
    try {
      const updated = await payload.update({
        collection: 'failure-cases' as any,
        id,
        data: {
          triageStatus: normalized.triageStatus,
          ...(normalized.failureStatus ? { status: normalized.failureStatus } : {}),
          ...(normalized.rootCauseCategory ? { rootCauseCategory: normalized.rootCauseCategory } : {}),
          ...(normalized.triageNotes ? { triageNotes: normalized.triageNotes } : {}),
          ...(normalized.verificationCoverage ? { verificationCoverage: normalized.verificationCoverage } : {}),
        },
        depth: 0,
        overrideAccess: true,
      })
      results.push({
        id,
        ok: true,
        failure: failureTriageSummary(updated, normalized),
      })
    } catch (e) {
      results.push({ id, ok: false, error: (e as Error).message })
    }
  }
  const failed = results.filter((item) => !item.ok).length
  return {
    ok: failed === 0,
    total: results.length,
    updated: results.length - failed,
    failed,
    results,
    customerValue: '审核员可批量确认 FailureCase 的归因、根因分类和复验覆盖，把自动聚类结果变成可复用失败知识。',
  }
}
