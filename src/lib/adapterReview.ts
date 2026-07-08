import type { Payload } from 'payload'
import { refreshAdapterLift } from './adapterProfile'
import { enqueueReverifyJob } from './reverifyQueue'

export const ADAPTER_REVIEW_STATUSES = new Set(['pending', 'needs_changes', 'approved', 'rejected'])
export const ADAPTER_REVIEWER_ROLES = new Set(['admin', 'reviewer'])

export type AdapterReviewStatus = 'pending' | 'needs_changes' | 'approved' | 'rejected'

type AutoReverifyEnqueue = typeof enqueueReverifyJob

function relationId(value: any): string | undefined {
  if (!value) return undefined
  return typeof value === 'object' ? String(value.id || '') || undefined : String(value)
}

export function normalizeAdapterReviewRequest(body: any):
  | { ok: true; ids: string[]; reviewStatus: AdapterReviewStatus; activate: boolean; reviewerNotes?: string; autoReverify: boolean }
  | { ok: false; reason: string } {
  const ids = (Array.isArray(body?.ids) ? body.ids : body?.id ? [body.id] : [])
    .map((id: unknown) => String(id || '').trim())
    .filter(Boolean)
  const uniqueIds = [...new Set(ids)] as string[]
  const limitedIds = uniqueIds.slice(0, 100)
  if (!limitedIds.length) return { ok: false, reason: '缺少 Adapter ids' }
  const reviewStatus = String(body?.reviewStatus || '').trim() as AdapterReviewStatus
  if (!ADAPTER_REVIEW_STATUSES.has(reviewStatus)) return { ok: false, reason: 'reviewStatus 不合法' }
  const activate = Boolean(body?.activate)
  if (activate && reviewStatus !== 'approved') return { ok: false, reason: '只有 approved 可以启用 Adapter' }
  const reviewerNotes = typeof body?.reviewerNotes === 'string' ? body.reviewerNotes.trim().slice(0, 1000) : undefined
  return { ok: true, ids: limitedIds, reviewStatus, activate, reviewerNotes, autoReverify: body?.autoReverify !== false }
}

async function findAdapterReverifyCandidates(payload: Payload, adapter: any) {
  const failureCaseId = relationId(adapter?.sourceFailureCase)
  const skillId = relationId(adapter?.skill)
  const adapterId = relationId(adapter?.id)
  if (!adapterId || !failureCaseId || !skillId) {
    return { failureCase: null, candidateRuns: [], groupedByUser: new Map<string, string[]>(), skipped: failureCaseId ? 'skill_missing' : 'source_failure_missing' }
  }
  const failureCase = await payload.findByID({
    collection: 'failure-cases' as any,
    id: failureCaseId,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null) as any
  if (!failureCase) return { failureCase: null, candidateRuns: [], groupedByUser: new Map<string, string[]>(), skipped: 'source_failure_missing' }
  const and: any[] = [
    { skill: { equals: skillId } },
    { success: { equals: false } },
    { adapterProfile: { exists: false } },
  ]
  const modelName = String(adapter?.modelName || failureCase.modelName || '').trim()
  const modelVersion = String(adapter?.modelVersion || failureCase.primaryModelVersion || '').trim()
  const errorType = String(failureCase.errorType || '').trim()
  if (modelName) and.push({ model: { equals: modelName } })
  if (modelVersion) and.push({ modelVersion: { equals: modelVersion } })
  if (errorType) and.push({ errorCode: { equals: errorType } })
  const runs = await payload.find({
    collection: 'skill-runs' as any,
    where: { and },
    limit: 100,
    depth: 0,
    sort: '-createdAt',
    overrideAccess: true,
  }).catch(() => ({ docs: [] as any[] }))
  const candidateRuns = (runs.docs as any[]).filter((run) => relationId(run?.user))
  const groupedByUser = new Map<string, string[]>()
  for (const run of candidateRuns) {
    const userId = relationId(run.user)
    if (!userId) continue
    const list = groupedByUser.get(userId) || []
    list.push(String(run.id))
    groupedByUser.set(userId, list)
  }
  return { failureCase, candidateRuns, groupedByUser, skipped: groupedByUser.size ? undefined : 'no_private_failed_runs' }
}

export async function autoReverifyApprovedAdapter(
  payload: Payload,
  adapter: any,
  opts: { enqueue?: AutoReverifyEnqueue; refreshLift?: boolean } = {},
) {
  const adapterId = relationId(adapter?.id)
  if (!adapterId) return { status: 'skipped', reason: 'adapter_missing' }
  if (String(adapter?.reviewStatus || '') !== 'approved' || String(adapter?.status || '') !== 'active') {
    return { status: 'skipped', reason: 'adapter_not_active' }
  }

  const { failureCase, candidateRuns, groupedByUser, skipped } = await findAdapterReverifyCandidates(payload, adapter)
  const failureCaseId = relationId(failureCase?.id) || relationId(adapter?.sourceFailureCase)
  const jobs: any[] = []
  if (failureCaseId && groupedByUser.size) {
    const enqueue = opts.enqueue || enqueueReverifyJob
    for (const [userId, candidateRunIds] of groupedByUser.entries()) {
      const queued = await enqueue(payload, {
        failureCaseId,
        userId,
        candidateRunIds,
        adapterIds: [adapterId],
        reason: 'adapter_approved',
      })
      jobs.push({ userId, candidateRunIds, ...queued })
    }
  }

  const lift = opts.refreshLift === false
    ? null
    : await refreshAdapterLift(payload, adapter).catch((e) => ({ error: (e as Error).message }))

  return {
    status: jobs.some((job) => job.enqueued) ? 'queued' : 'skipped',
    reason: jobs.length ? undefined : skipped || 'no_reverify_jobs',
    failureCaseId: failureCaseId || null,
    adapterId,
    candidateRuns: candidateRuns.length,
    userJobs: jobs.length,
    enqueued: jobs.filter((job) => job.enqueued).length,
    skipped: jobs.filter((job) => !job.enqueued).length,
    skipReasons: jobs.filter((job) => !job.enqueued).map((job) => job.skipped).filter(Boolean),
    liftRefreshed: Boolean(lift && !(lift as any).error),
  }
}

export async function reviewAdapters(
  payload: Payload,
  args: {
    ids: string[]
    reviewStatus: AdapterReviewStatus
    activate?: boolean
    reviewerNotes?: string
    autoReverify?: boolean
    enqueueReverify?: AutoReverifyEnqueue
  },
) {
  const results: Array<{ id: string; ok: boolean; status?: string; reviewStatus?: string; reviewedAt?: string | null; autoReverify?: any; error?: string }> = []
  for (const id of args.ids) {
    const adapter = await payload.findByID({ collection: 'adapter-profiles' as any, id, depth: 0, overrideAccess: true }).catch(() => null) as any
    if (!adapter) {
      results.push({ id, ok: false, error: 'Adapter 不存在' })
      continue
    }
    try {
      const updated = await payload.update({
        collection: 'adapter-profiles' as any,
        id,
        data: {
          reviewStatus: args.reviewStatus,
          ...(args.reviewerNotes ? { reviewerNotes: args.reviewerNotes } : {}),
          ...(args.activate ? { status: 'active' } : args.reviewStatus === 'rejected' ? { status: 'disabled' } : {}),
        },
        depth: 0,
        overrideAccess: true,
      }) as any
      const reviewedAdapter = { ...adapter, ...updated }
      const autoReverify = args.autoReverify === false || args.reviewStatus !== 'approved'
        ? undefined
        : await autoReverifyApprovedAdapter(payload, reviewedAdapter, { enqueue: args.enqueueReverify })
      results.push({
        id,
        ok: true,
        status: updated.status || 'draft',
        reviewStatus: updated.reviewStatus || args.reviewStatus,
        reviewedAt: updated.reviewedAt || null,
        ...(autoReverify ? { autoReverify } : {}),
      })
    } catch (e) {
      results.push({ id, ok: false, error: (e as Error).message })
    }
  }
  const approved = results.filter((r) => r.ok && r.reviewStatus === 'approved').length
  const failed = results.filter((r) => !r.ok).length
  const autoReverify = {
    queued: results.reduce((sum, r) => sum + Number(r.autoReverify?.enqueued || 0), 0),
    candidateRuns: results.reduce((sum, r) => sum + Number(r.autoReverify?.candidateRuns || 0), 0),
    adapters: results.filter((r) => r.autoReverify).length,
  }
  return {
    ok: failed === 0,
    total: results.length,
    updated: results.length - failed,
    approved,
    failed,
    autoReverify,
    results,
    customerValue: '审核员可一次性处理多个 Adapter 草稿；批准启用后会自动找同类私人失败运行入复验队列，让补丁 lift 用真实回流自证。',
  }
}
