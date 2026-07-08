import type { Payload } from 'payload'
import { deriveBenchmarkCases, type BenchmarkInputCase } from './benchmark'
import { evaluateEnterprisePolicy, canManageOrganization, modelAllowedByRegistry, publicEnterpriseRegistry } from './enterprise'
import { publicSanitize } from './publicSanitize'
import { runSkill, type RunSkillResult } from './skillRunner'
import { resolveCurrentSkillVersionForPublicEvidence } from './skillVersionPublic'

const MAX_MODELS = 4
const MAX_CASES = 20
const MAX_ATTEMPTS = 80
const MAX_CASE_INPUT_BYTES = 20_000
const MAX_CASE_TEXT_BYTES = 2_000

export type EnterpriseBenchmarkCase = {
  input: Record<string, unknown>
  testCase: {
    id?: string
    title?: string
    expectedOutputShape?: unknown
    requiredOutputPaths?: unknown
    expectedTextIncludes?: unknown
    minScore?: number
  }
  privateCase: boolean
}

export type EnterpriseBenchmarkRequest =
  | { ok: true; models?: string[]; cases?: EnterpriseBenchmarkCase[]; maxAttempts?: number }
  | { ok: false; reason: string }

function relationId(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'object') return String((value as any).id || '') || undefined
  return String(value)
}

function compactString(value: unknown, limit = 160): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, limit)
}

function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8')
}

function normalizeStringList(value: unknown, limit: number): string[] | undefined {
  if (value == null) return undefined
  if (!Array.isArray(value)) return undefined
  const out = value.map((item) => compactString(item, 160)).filter(Boolean) as string[]
  return [...new Set(out)].slice(0, limit)
}

function normalizeMinScore(value: unknown): number | undefined {
  if (value == null || value === '') return undefined
  const n = Number(value)
  if (!Number.isFinite(n)) return undefined
  return Math.min(1, Math.max(0, n))
}

function normalizePrivateCase(value: unknown, index: number): EnterpriseBenchmarkCase | { error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: `cases[${index}] 必须是对象` }
  const raw = value as any
  const input = raw.inputJson ?? raw.input
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: `cases[${index}].input 必须是 JSON 对象` }
  if (jsonBytes(input) > MAX_CASE_INPUT_BYTES) return { error: `cases[${index}].input 过大` }
  const expectedTextIncludes = normalizeStringList(raw.expectedTextIncludes, 20)
  if (expectedTextIncludes && jsonBytes(expectedTextIncludes) > MAX_CASE_TEXT_BYTES) {
    return { error: `cases[${index}].expectedTextIncludes 过大` }
  }
  const requiredOutputPaths = normalizeStringList(raw.requiredOutputPaths, 50)
  const testCase = {
    id: `private-${index + 1}`,
    title: compactString(raw.title || raw.name, 120) || `企业私有样例 ${index + 1}`,
    expectedOutputShape:
      raw.expectedOutputShape && typeof raw.expectedOutputShape === 'object' && !Array.isArray(raw.expectedOutputShape)
        ? raw.expectedOutputShape
        : undefined,
    requiredOutputPaths,
    expectedTextIncludes,
    minScore: normalizeMinScore(raw.minScore),
  }
  return { input, testCase, privateCase: true }
}

export function normalizeEnterpriseBenchmarkRequest(body: unknown): EnterpriseBenchmarkRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, reason: '请求体必须是 JSON 对象' }
  const raw = body as any
  const models = normalizeStringList(raw.models, MAX_MODELS)
  if (raw.models != null && !Array.isArray(raw.models)) return { ok: false, reason: 'models 必须是字符串数组' }

  let cases: EnterpriseBenchmarkCase[] | undefined
  if (raw.cases != null) {
    if (!Array.isArray(raw.cases)) return { ok: false, reason: 'cases 必须是数组' }
    if (raw.cases.length > MAX_CASES) return { ok: false, reason: `cases 最多 ${MAX_CASES} 条` }
    cases = []
    for (let i = 0; i < raw.cases.length; i++) {
      const item = normalizePrivateCase(raw.cases[i], i)
      if ('error' in item) return { ok: false, reason: item.error }
      cases.push(item)
    }
  }

  const maxAttemptsRaw = raw.maxAttempts ?? raw.max_attempts
  let maxAttempts: number | undefined
  if (maxAttemptsRaw != null && maxAttemptsRaw !== '') {
    const n = Number(maxAttemptsRaw)
    if (!Number.isFinite(n) || n < 1) return { ok: false, reason: 'maxAttempts 必须是正数' }
    maxAttempts = Math.min(MAX_ATTEMPTS, Math.floor(n))
  }

  return {
    ok: true,
    models: models?.length ? models : undefined,
    cases: cases?.length ? cases : undefined,
    maxAttempts,
  }
}

function allowlistModels(allowlist: unknown): string[] {
  if (!allowlist) return []
  if (Array.isArray(allowlist)) return allowlist.map((item) => compactString(item)).filter(Boolean) as string[]
  if (typeof allowlist === 'object') {
    const models = (allowlist as any).models
    if (Array.isArray(models)) return models.map((item) => compactString(item)).filter(Boolean) as string[]
  }
  return []
}

function versionModels(version: any): string[] {
  const recommended = Array.isArray(version?.recommendedModels?.cloud) ? version.recommendedModels.cloud : []
  const strategies = version?.routePolicy?.strategies && typeof version.routePolicy.strategies === 'object'
    ? Object.values(version.routePolicy.strategies).flatMap((item) => (Array.isArray(item) ? item : []))
    : []
  return [...recommended, ...strategies].map((item) => compactString(item)).filter(Boolean) as string[]
}

export function resolveEnterpriseBenchmarkModels(args: {
  requested?: string[]
  registryAllowlist?: unknown
  organizationAllowlist?: unknown
  version?: any
}): { models: string[]; rejectedModels: string[] } {
  const registryModels = allowlistModels(args.registryAllowlist)
  const orgModels = allowlistModels(args.organizationAllowlist)
  const allowlist = registryModels.length ? registryModels : orgModels
  const source = args.requested?.length
    ? args.requested
    : allowlist.length
      ? allowlist
      : versionModels(args.version)
  const unique = [...new Set(source.map((item) => compactString(item)).filter(Boolean) as string[])]
  const models = unique
    .filter((model) => modelAllowedByRegistry(args.registryAllowlist || args.organizationAllowlist, model))
    .slice(0, MAX_MODELS)
  const rejectedModels = unique.filter((model) => !models.includes(model))
  return { models, rejectedModels }
}

function publicCaseLabel(testCase: any, index: number) {
  return {
    caseId: testCase?.id ? String(testCase.id) : `case-${index + 1}`,
    title: compactString(testCase?.title, 120) || `样例 ${index + 1}`,
  }
}

function toEnterpriseCase(item: BenchmarkInputCase, index: number): EnterpriseBenchmarkCase {
  return {
    input: item.input,
    testCase: {
      id: item.testCase?.id ? String(item.testCase.id) : `benchmark-${index + 1}`,
      title: item.testCase?.title || `基准样例 ${index + 1}`,
      expectedOutputShape: item.testCase?.expectedOutputShape,
      requiredOutputPaths: item.testCase?.requiredOutputPaths,
      expectedTextIncludes: item.testCase?.expectedTextIncludes,
      minScore: item.testCase?.minScore,
    },
    privateCase: false,
  }
}

function resultCode(result: RunSkillResult | null, thrown?: unknown) {
  if (result?.errorCode) return String(result.errorCode)
  if (thrown) return 'RUN_FAILED'
  return result?.ok ? undefined : 'RUN_FAILED'
}

export type EnterpriseBenchmarkRunRow = {
  model: string
  caseId: string
  title: string
  ok: boolean
  formatValid: boolean
  scored: boolean
  score?: number
  passed?: boolean
  mocked?: boolean
  runId?: string
  skillRunId?: string
  errorCode?: string
}

export function summarizeEnterpriseBenchmarkResults(rows: EnterpriseBenchmarkRunRow[]) {
  const byModel = new Map<string, any>()
  for (const row of rows) {
    const current = byModel.get(row.model) || {
      model: row.model,
      attempted: 0,
      succeeded: 0,
      formatValid: 0,
      scored: 0,
      passed: 0,
      mocked: 0,
      averageScore: 0,
      _scoreSum: 0,
    }
    current.attempted += 1
    if (row.ok) current.succeeded += 1
    if (row.formatValid) current.formatValid += 1
    if (row.scored && typeof row.score === 'number') {
      current.scored += 1
      current._scoreSum += row.score
      if (row.passed) current.passed += 1
    }
    if (row.mocked) current.mocked += 1
    byModel.set(row.model, current)
  }
  const models = [...byModel.values()].map((item) => {
    const { _scoreSum, ...rest } = item
    return { ...rest, averageScore: rest.scored ? Math.round((_scoreSum / rest.scored) * 1000) / 1000 : 0 }
  })
  const scored = rows.filter((row) => row.scored && typeof row.score === 'number')
  const attempted = rows.length
  return {
    attempted,
    succeeded: rows.filter((row) => row.ok).length,
    formatValid: rows.filter((row) => row.formatValid).length,
    scored: scored.length,
    passed: scored.filter((row) => row.passed).length,
    mocked: rows.filter((row) => row.mocked).length,
    averageScore: scored.length
      ? Math.round((scored.reduce((sum, row) => sum + Number(row.score || 0), 0) / scored.length) * 1000) / 1000
      : 0,
    byModel: models,
  }
}

export async function enterprisePrivateBenchmark(
  payload: Payload,
  args: {
    actorId: string
    actorRole?: string
    registryId: string
    models?: string[]
    cases?: EnterpriseBenchmarkCase[]
    maxAttempts?: number
  },
  deps: { runSkill?: typeof runSkill } = {},
) {
  const registry = await payload
    .findByID({ collection: 'enterprise-registries' as any, id: args.registryId, depth: 1, overrideAccess: true })
    .catch(() => null) as any
  if (!registry) return { ok: false as const, reason: '企业注册记录不存在' }
  const organizationId = relationId(registry.organization)
  const skillId = relationId(registry.skill)
  if (!organizationId || !skillId) return { ok: false as const, reason: '注册记录缺少组织或 Skill' }

  const access = await canManageOrganization(payload, {
    userId: args.actorId,
    userRole: args.actorRole,
    organizationId,
    roles: ['platform_admin', 'owner', 'admin', 'approver'],
  })
  if (!access.ok) return access

  if (['disabled', 'deprecated'].includes(String(registry.approvalStatus || ''))) {
    return { ok: false as const, reason: '该企业 Skill 已禁用或废弃，不可发起私有评测' }
  }

  const organization = typeof registry.organization === 'object' && registry.organization?.id
    ? registry.organization
    : await payload.findByID({ collection: 'organizations' as any, id: organizationId, depth: 0, overrideAccess: true }).catch(() => null)
  const skill = typeof registry.skill === 'object' && registry.skill?.id
    ? registry.skill
    : await payload.findByID({ collection: 'skills' as any, id: skillId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!skill) return { ok: false as const, reason: 'Skill 不存在' }

  const versionId = relationId(registry.skillVersion) || relationId(skill.currentVersion)
  const version = versionId
    ? await payload.findByID({ collection: 'skill-versions' as any, id: versionId, depth: 0, overrideAccess: true }).catch(() => null)
    : await resolveCurrentSkillVersionForPublicEvidence(payload, skill).catch(() => null)
  if (!version) return { ok: false as const, reason: '缺少可评测 Skill 版本' }
  if (relationId(version.skill) && relationId(version.skill) !== skillId) return { ok: false as const, reason: '锁定版本不属于该 Skill' }
  if (version.status === 'deprecated') return { ok: false as const, reason: '锁定版本已废弃' }

  const modelSelection = resolveEnterpriseBenchmarkModels({
    requested: args.models,
    registryAllowlist: registry.modelAllowlist,
    organizationAllowlist: organization?.modelAllowlist,
    version,
  })
  if (!modelSelection.models.length) return { ok: false as const, reason: '没有可用于企业私有评测的模型' }

  const cases = args.cases?.length
    ? args.cases.slice(0, MAX_CASES)
    : (await deriveBenchmarkCases(payload, skillId, version)).slice(0, MAX_CASES).map(toEnterpriseCase)
  if (!cases.length) return { ok: false as const, reason: '没有可用于企业私有评测的样例' }

  const maxAttempts = Math.min(
    Math.max(1, Number(args.maxAttempts || modelSelection.models.length * cases.length)),
    MAX_ATTEMPTS,
  )
  const rows: EnterpriseBenchmarkRunRow[] = []
  const runner = deps.runSkill || runSkill
  let attempted = 0

  for (const model of modelSelection.models) {
    for (let i = 0; i < cases.length; i++) {
      if (attempted >= maxAttempts) break
      const item = cases[i]
      const caseLabel = publicCaseLabel(item.testCase, i)
      const policy = evaluateEnterprisePolicy(registry.auditPolicy || organization?.policy, {
        input: item.input,
        routeMode: 'balanced',
        byok: false,
      })
      if (!policy.ok) {
        rows.push({
          model,
          ...caseLabel,
          ok: false,
          formatValid: false,
          scored: false,
          errorCode: 'ENTERPRISE_POLICY_DENIED',
        })
        attempted++
        continue
      }
      let result: RunSkillResult | null = null
      let thrown: unknown
      try {
        result = await runner({
          payload,
          skill,
          version,
          input: item.input,
          user: { id: args.actorId },
          forceModel: model,
          benchmark: true,
          benchmarkCase: item.testCase,
          skipAggregate: true,
          skipCompatReport: true,
          organizationId,
          enterprisePrivateBenchmark: true,
          enterpriseRegistryId: String(registry.id),
        })
      } catch (e) {
        thrown = e
      }
      rows.push({
        model,
        ...caseLabel,
        ok: result?.ok === true,
        formatValid: result?.formatValid === true,
        scored: !!result?.benchmarkScore,
        score: result?.benchmarkScore?.score,
        passed: result?.benchmarkScore?.passed,
        mocked: result?.mocked === true,
        runId: result?.runId,
        skillRunId: result?.skillRunId,
        errorCode: resultCode(result, thrown),
      })
      attempted++
    }
    if (attempted >= maxAttempts) break
  }

  const summary = summarizeEnterpriseBenchmarkResults(rows)
  return {
    ok: true as const,
    organizationId,
    registry: publicEnterpriseRegistry(registry),
    models: modelSelection.models,
    rejectedModels: modelSelection.rejectedModels,
    caseCount: cases.length,
    privateCaseCount: cases.filter((item) => item.privateCase).length,
    summary,
    results: rows.map((row) => publicSanitize(row)),
    privacy: {
      scope: 'enterprise_private',
      compatReportWritten: false,
      publicPassportUpdated: false,
      publicLeaderboardUpdated: false,
      inputOutputReturned: false,
      note: '企业私有评测只写 SkillRuns 与企业审计；响应不返回私有输入、输出或判定文本原文。',
    },
    playbook: {
      customerValue: '用组织自己的样例验证 Skill 是否适合内部准入，不污染公开可信榜，也不把私有任务样本暴露给平台公共证据。',
      nextActions: [
        '若通过率不足，先限制模型白名单或要求创作者补 Adapter。',
        '若要形成公开达标证书，请改走平台黄金样例 benchmark 和公开证据验签链。',
        '上线后继续查看企业审计导出和企业失败库，跟踪员工真实使用中的漂移。',
      ],
    },
  }
}
