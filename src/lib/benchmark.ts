import type { Payload } from 'payload'
import { runSkill } from './skillRunner'
import { recomputeLocalScore } from './compat'
import { approvedPlatformModels } from './constants'
import { resolveRuntimeEnv, type RuntimeEnv } from './deploymentSettings'
import { refreshSkillPassport } from './passportRefresh'
import { refreshFailureCasesForSkill } from './failureRefresh'
import type { BenchmarkCaseScore } from './benchmarkScoring'

// 发布即评测(#8)：对一个 Skill 用其黄金样例 × 一组模型跑系统评测，回流 source=benchmark 兼容报告，
// 再重算兼容分——让新 Skill 出生即带初始数据，消灭详情页"N=0 战绩积累中"的劝退。
// 成本记平台(四面墙 margin=0)；mock 模式(未配网关)不产真实数据，仅返回 mocked 计数。

const MAX_EXAMPLES = 5
const MAX_MODELS = 4
const DEFAULT_STR = '示例输入'

export type BenchmarkInputCase = {
  input: Record<string, unknown>
  testCase?: any
}

// 从 version 取评测输入集：优先 CompatTestCase，其次黄金样例 input；无则由 inputSchema 派生一条最小合法输入。
export function deriveInputsFromVersion(version: any): Record<string, unknown>[] {
  const examples = Array.isArray(version?.examples) ? version.examples : []
  const fromExamples = examples
    .map((e: any) => e?.input)
    .filter((i: any) => i && typeof i === 'object')
    .slice(0, MAX_EXAMPLES)
  if (fromExamples.length > 0) return fromExamples

  const schema = (version?.inputSchema || {}) as Record<string, any>
  const keys = Object.keys(schema)
  if (keys.length === 0) return [{}] // 无输入字段：跑一条空输入
  const one: Record<string, unknown> = {}
  for (const k of keys) {
    const def = schema[k] || {}
    if (Array.isArray(def.options) && def.options.length > 0) {
      const opt = def.options[0]
      one[k] = typeof opt === 'object' ? (opt.value ?? opt.label ?? DEFAULT_STR) : opt
    } else if (def.type === 'number') one[k] = 1
    else if (def.type === 'boolean') one[k] = true
    else one[k] = DEFAULT_STR
  }
  return [one]
}

export async function deriveBenchmarkCases(
  payload: Payload,
  skillId: string,
  version: any,
): Promise<BenchmarkInputCase[]> {
  const cases = await payload.find({
    collection: 'compat-test-cases' as any,
    where: {
      and: [
        { skill: { equals: skillId } },
        { enabled: { equals: true } },
        {
          or: [
            { skillVersion: { equals: version?.id } },
            { skillVersion: { exists: false } },
          ],
        },
      ],
    },
    limit: MAX_EXAMPLES,
    depth: 0,
    overrideAccess: true,
    sort: 'createdAt',
  }).catch(() => ({ docs: [] as any[] }))
  const fromCases = (cases.docs as any[])
    .filter((c) => c.inputJson && typeof c.inputJson === 'object')
    .slice(0, MAX_EXAMPLES)
    .map((c) => ({ input: c.inputJson, testCase: c }))
  return fromCases.length > 0 ? fromCases : deriveInputsFromVersion(version).map((input) => ({ input }))
}

export async function deriveBenchmarkInputs(
  payload: Payload,
  skillId: string,
  version: any,
): Promise<Record<string, unknown>[]> {
  return (await deriveBenchmarkCases(payload, skillId, version)).map((item) => item.input)
}

// 选评测模型：入参优先 → 作者推荐云模型 ∩ 已备案白名单 → 默认取白名单前若干
function pickModels(version: any, env: RuntimeEnv, models?: string[]): string[] {
  const approved = approvedPlatformModels(env)
  const source: string[] = models && models.length ? models : version?.recommendedModels?.cloud || []
  let list = source.filter((m) => approved.has(m))
  if (list.length === 0) list = [...approved].slice(0, 3)
  return [...new Set(list)].slice(0, MAX_MODELS)
}

export interface BenchmarkResult {
  models: string[]
  inputs: number
  attempted: number
  mocked: number
  reported: number // 真实(非 mock)运行数，约等于新增 benchmark 报告数
  localScore: number
  scored: number
  passed: number
  averageBenchmarkScore: number
  caseResults: Array<{ caseId?: string; title?: string; model: string; score: number; passed: boolean }>
}

export async function benchmarkSkill(
  payload: Payload,
  args: { skill: any; version: any; models?: string[]; maxAttempts?: number },
): Promise<BenchmarkResult> {
  const { skill, version } = args
  const cases = await deriveBenchmarkCases(payload, String(skill.id), version)
  const inputs = cases.map((item) => item.input)
  const runtimeEnv = await resolveRuntimeEnv(payload)
  const models = pickModels(version, runtimeEnv, args.models)
  const maxAttempts = Math.max(1, Number(args.maxAttempts || MAX_EXAMPLES * MAX_MODELS))

  let attempted = 0
  let mocked = 0
  let reported = 0
  const caseResults: BenchmarkResult['caseResults'] = []
  for (const model of models) {
    for (const item of cases) {
      const input = item.input
      if (attempted >= maxAttempts) break
      attempted++
      try {
        const r = await runSkill({
          payload,
          skill,
          version,
          input,
          forceModel: model,
          benchmark: true,
          benchmarkCase: item.testCase,
          skipAggregate: true, // 不污染履约 headline 指标；benchmark 只喂 compat 报告→兼容分
        })
        if (r.mocked) mocked++
        else reported++
        if (r.benchmarkScore) {
          caseResults.push({
            caseId: item.testCase?.id ? String(item.testCase.id) : undefined,
            title: item.testCase?.title,
            model,
            score: r.benchmarkScore.score,
            passed: r.benchmarkScore.passed,
          })
        }
      } catch (e) {
        payload.logger?.error(`benchmark 运行失败 skill=${skill.slug} model=${model}: ${(e as Error).message}`)
      }
    }
    if (attempted >= maxAttempts) break
  }

  // 重算兼容分（benchmark 报告已写入 compat-reports，此处收敛出初始分）
  let localScore = 0
  try {
    localScore = await recomputeLocalScore(payload, skill.id as string)
    await refreshSkillPassport(payload, String(skill.id))
    await refreshFailureCasesForSkill(payload, String(skill.id))
  } catch (e) {
    payload.logger?.error(`benchmark 后刷新评分/Passport 失败: ${(e as Error).message}`)
  }

  const scored = caseResults.length
  const passed = caseResults.filter((item) => item.passed).length
  const averageBenchmarkScore = scored ? Math.round((caseResults.reduce((sum, item) => sum + item.score, 0) / scored) * 1000) / 1000 : 0
  return { models, inputs: inputs.length, attempted, mocked, reported, localScore, scored, passed, averageBenchmarkScore, caseResults }
}
