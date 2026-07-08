import type { Payload } from 'payload'
import { decryptSecret } from './secrets'
import { canRerunPrivateLedgerSkill } from './skillEvidenceAccess'
import {
  isValidationError,
  normalizeOptionalModelProvider,
  normalizeOptionalModelVersion,
  normalizeRerunModel,
  type SkillRunRequestError,
} from './skillRunRequest'
import { runSkill, type RunSkillResult } from './skillRunner'
import { isUsableSkillVersionForPublicEvidence, resolveCurrentSkillVersionForPublicEvidence } from './skillVersionPublic'

export const MAX_BULK_RERUN_IDS = 20

export type NormalizedPrivateRerunRequest =
  | { ok: true; ids: string[]; model: string; modelProvider?: string; modelVersion?: string }
  | { ok: false; status: 400 | 413; error: string }

export type PrivateRunRerunResponse = {
  status: number
  body: RunSkillResult | { error: string }
  sourceRunId?: string
  sourceModel?: string
}

function relationId(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'object') return String((value as any).id || '') || undefined
  return String(value)
}

function isRequestError(value: unknown): value is SkillRunRequestError {
  return isValidationError(value)
}

function normalizeRunId(value: unknown): string | undefined {
  const id = typeof value === 'string' ? value.trim() : ''
  if (!id || id.length > 160) return undefined
  return id
}

export function statusForRunSkillResult(result: RunSkillResult): number {
  return result.ok
    ? 200
    : result.errorCode === 'INSUFFICIENT_CREDIT'
      ? 402
      : result.errorCode === 'MODEL_REQUIRES_BYOK'
        ? 403
        : result.errorCode === 'PLATFORM_TOKEN_UNAVAILABLE'
          ? 503
          : result.errorCode === 'RATE_LIMITED'
            ? 429
            : 422
}

export function normalizeBulkPrivateRerunRequest(body: unknown): NormalizedPrivateRerunRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: '请求体必须是 JSON 对象' }
  }
  const raw = body as any
  const rawIds = raw.ids ?? raw.runIds ?? raw.runs
  if (!Array.isArray(rawIds)) return { ok: false, status: 400, error: 'ids 必须是运行 ID 数组' }
  const ids = [...new Set(rawIds.map(normalizeRunId).filter(Boolean) as string[])]
  if (!ids.length) return { ok: false, status: 400, error: '缺少 ids' }
  if (ids.length > MAX_BULK_RERUN_IDS) return { ok: false, status: 413, error: `一次最多重跑 ${MAX_BULK_RERUN_IDS} 条` }

  const model = normalizeRerunModel(raw.model)
  if (isRequestError(model)) return model
  const modelProvider = normalizeOptionalModelProvider(raw.modelProvider)
  if (isRequestError(modelProvider)) return modelProvider
  const modelVersion = normalizeOptionalModelVersion(raw.modelVersion)
  if (isRequestError(modelVersion)) return modelVersion

  return { ok: true, ids, model, modelProvider, modelVersion }
}

export function publicBulkRerunItem(sourceRunId: string, response: PrivateRunRerunResponse) {
  const body = response.body as any
  return {
    sourceRunId,
    status: response.status,
    ok: body?.ok === true,
    runId: body?.runId || null,
    skillRunId: body?.skillRunId || null,
    model: body?.model || null,
    modelVersion: body?.modelVersion || null,
    routeMode: body?.routeMode || null,
    cost: body?.cost ?? null,
    chargedCredits: body?.chargedCredits ?? 0,
    savedAmount: body?.savedAmount ?? 0,
    latencyMs: body?.latencyMs ?? null,
    mocked: body?.mocked === true,
    formatValid: body?.formatValid === true,
    errorCode: body?.errorCode || null,
    error: body?.error || (Array.isArray(body?.errors) ? body.errors[0] : null) || null,
  }
}

export async function rerunPrivateLedgerRun(
  payload: Payload,
  args: {
    user: { id: string } & Record<string, unknown>
    sourceRunId: string
    model: string
    modelProvider?: string
    modelVersion?: string
    userApiKey?: string
  },
  deps: { runSkill?: typeof runSkill } = {},
): Promise<PrivateRunRerunResponse> {
  const run = await payload
    .findByID({ collection: 'skill-runs' as any, id: args.sourceRunId, depth: 0, overrideAccess: true })
    .catch(() => null) as any
  if (!run) return { status: 404, body: { error: '运行记录不存在' }, sourceRunId: args.sourceRunId }
  const runUserId = relationId(run.user)
  if (String(runUserId) !== String(args.user.id)) {
    return { status: 403, body: { error: '只能重跑自己的运行' }, sourceRunId: String(run.id), sourceModel: run.model }
  }

  const skillId = relationId(run.skill)
  const skill = skillId
    ? await payload.findByID({ collection: 'skills' as any, id: skillId, depth: 1, overrideAccess: true }).catch(() => null)
    : null
  if (!skill) return { status: 404, body: { error: 'Skill 不存在' }, sourceRunId: String(run.id), sourceModel: run.model }
  if (!canRerunPrivateLedgerSkill(skill, args.user)) {
    return { status: 403, body: { error: '该 Skill 当前不可重跑' }, sourceRunId: String(run.id), sourceModel: run.model }
  }

  let version: any = run.skillVersion
  if (!version || typeof version === 'string') {
    version = version
      ? await payload
          .findByID({ collection: 'skill-versions' as any, id: version, overrideAccess: true })
          .catch(() => null)
      : await resolveCurrentSkillVersionForPublicEvidence(payload, skill)
  }
  if (!version) return { status: 400, body: { error: '版本不存在' }, sourceRunId: String(run.id), sourceModel: run.model }
  if (!isUsableSkillVersionForPublicEvidence(skill, version)) {
    return { status: 400, body: { error: '版本已不可重跑' }, sourceRunId: String(run.id), sourceModel: run.model }
  }

  let userApiKey = args.userApiKey
  if (userApiKey === undefined) {
    const fullUser = await payload
      .findByID({ collection: 'users' as any, id: args.user.id, overrideAccess: true, depth: 0 })
      .catch(() => null)
    userApiKey = decryptSecret((fullUser as any)?.newapiKeyEncrypted) || undefined
  }

  const runner = deps.runSkill || runSkill
  const result = await runner({
    payload,
    skill,
    version,
    input: (run.inputJson || {}) as Record<string, unknown>,
    user: { id: args.user.id },
    userApiKey,
    forceModel: args.model,
    modelProvider: args.modelProvider,
    modelVersion: args.modelVersion,
    rerunOf: String(run.id),
    rerunFromModel: run.model ? String(run.model) : undefined,
  })

  return {
    status: statusForRunSkillResult(result),
    body: result,
    sourceRunId: String(run.id),
    sourceModel: run.model ? String(run.model) : undefined,
  }
}
