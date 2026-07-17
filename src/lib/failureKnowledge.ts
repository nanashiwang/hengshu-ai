import type { ErrorType } from './errorTaxonomy'

export interface FailureKnowledgeReport {
  errorType?: string | null
  modelName?: string | null
  modelVersion?: string | null
  skill?: string | { id?: string; title?: string; slug?: string } | null
  inputSizeBucket?: string | null
  outputSizeBucket?: string | null
  source?: string | null
  suppressed?: boolean | null
}

export interface FailureKnowledgeGroup {
  profileKey: string
  errorType: ErrorType | string
  modelName: string
  primaryInputBucket: string
  primaryModelVersion: string | null
  count: number
  skillCount: number
  sampleSkills: { id: string; title: string; slug?: string }[]
  inputBuckets: string[]
  outputBuckets: string[]
  modelBreakdown: Record<string, number>
  modelVersions: string[]
  modelVersionBreakdown: Record<string, number>
  sourceBreakdown: Record<string, number>
  meta: FailureMeta
}

export interface FailureMeta {
  label: string
  layer: '基础设施' | '模型能力'
  symptom: string
  likelyCause: string
  publicFixHint: string
  repairTemplate: string
  verifyTemplate: string
}

export const FAILURE_META: Record<string, FailureMeta> = {
  network: {
    label: '网络连接失败',
    layer: '基础设施',
    symptom: '请求未稳定抵达模型网关，常见表现是 fetch failed、连接重置或 DNS 失败。',
    likelyCause: '运行环境到网关链路不稳定，或网关地址/代理配置不可达。',
    publicFixHint: '先换网络或检查网关地址；若只在某 Runner 出现，优先排查本机代理。',
    repairTemplate: '检查 MODEL_GATEWAY_BASE_URL / 代理 / DNS；Runner 本地执行一次最小 prompt，并记录是否仍 network。',
    verifyTemplate: '用同一 Skill、同一模型重跑 2 次；若 errorType 不再出现且 latencyMs 正常，即可视为修复。',
  },
  timeout: {
    label: '调用超时',
    layer: '基础设施',
    symptom: '模型长时间无响应或请求被中断。',
    likelyCause: '输入过长、模型拥塞、网关超时阈值过低，或复杂任务超过当前模型响应能力。',
    publicFixHint: '优先缩短输入或切换更快模型；若集中在某模型，暂时从路由中降权。',
    repairTemplate: '把输入拆段；提高超时阈值；给 routePolicy.fast 加入历史低延迟模型。',
    verifyTemplate: '用同一输入规模档重跑；连续 2 次完成且耗时低于历史 P75 即通过。',
  },
  rate_limit: {
    label: '上游限流',
    layer: '基础设施',
    symptom: '网关或模型返回 429 / too many requests。',
    likelyCause: '当前 Key、分组或模型通道达到限速。',
    publicFixHint: '降低并发或换 BYOK；平台代付场景等待限流窗口恢复。',
    repairTemplate: '为该模型设置更低并发；增加 fallback；BYOK 用户检查供应商配额。',
    verifyTemplate: '等待 60 秒后重跑；若 fallback 能成功，保留 fallback 并降低主模型权重。',
  },
  auth: {
    label: '鉴权失败',
    layer: '基础设施',
    symptom: '401/403、invalid key、forbidden 等鉴权错误。',
    likelyCause: 'BYOK Key 错误、过期、无模型权限，或网关子令牌未正确下发。',
    publicFixHint: '重新绑定 Key；平台代付路径需等待子令牌同步。',
    repairTemplate: '重新保存 BYOK；确认模型权限；平台侧执行 worker:sync-newapi-quota 后再测。',
    verifyTemplate: '使用最小 prompt 调同一模型；若不再 auth 且产生 token 计数，即通过。',
  },
  http_4xx: {
    label: '请求参数错误',
    layer: '基础设施',
    symptom: '上游返回 4xx，但不属于鉴权。',
    likelyCause: '模型名、参数、上下文长度或网关请求格式不被该通道接受。',
    publicFixHint: '核对模型名和输入规模；过长输入先拆分。',
    repairTemplate: '确认模型名在网关可用；降低 maxTokens；为超长输入增加切片策略。',
    verifyTemplate: '用 0-500 输入规模档先验证，再逐步放大到原输入规模。',
  },
  http_5xx: {
    label: '上游服务异常',
    layer: '基础设施',
    symptom: '网关或供应商返回 5xx / unavailable。',
    likelyCause: '供应商短时故障、通道熔断或网关内部错误。',
    publicFixHint: '短期切换 fallback；不要把该结果当作 Skill 本身失败。',
    repairTemplate: '临时把该模型从主路由降级到 fallback；观察 24 小时后恢复。',
    verifyTemplate: '跨 2 个时间窗重跑；若 5xx 消失且成功率恢复，再重新纳入主路由。',
  },
  unknown_infra: {
    label: '未知基础设施错误',
    layer: '基础设施',
    symptom: '调用失败但无法归类到网络、超时、限流、鉴权或 HTTP 错误。',
    likelyCause: '网关返回了非标准错误，或客户端异常未被当前分类器识别。',
    publicFixHint: '先换模型/网关复验；若可稳定复现，再补充错误分类。',
    repairTemplate: '保留 runId；在服务端日志按 runId 追踪上游错误，必要时扩展 errorTaxonomy。',
    verifyTemplate: '修复分类后重跑；新错误应进入明确 errorType，而不是 unknown_infra。',
  },
  empty_output: {
    label: '空输出',
    layer: '模型能力',
    symptom: '模型调用成功但返回空文本。',
    likelyCause: '模型安全拒答、输出被截断、prompt 缺少明确输出要求，或通道异常吞掉内容。',
    publicFixHint: '给 prompt 增加强制输出格式和最小字数要求。',
    repairTemplate: '在 system prompt 明确“必须输出非空结果”；降低温度并设置 fallback。',
    verifyTemplate: '用原输入重跑；输出长度进入非 0 档且 schema 通过即视为修复。',
  },
  json_invalid: {
    label: '非 JSON 输出',
    layer: '模型能力',
    symptom: 'Skill 要求结构化输出，但模型返回自然语言或无法解析的 JSON。',
    likelyCause: 'prompt 对 JSON 约束不够强，或该模型结构化遵循能力不足。',
    publicFixHint: '加强 JSON-only 指令，必要时换结构化更稳的模型。',
    repairTemplate: '加入“只输出 JSON，不要 Markdown”与示例；必要时给 outputSchema 对齐字段名。',
    verifyTemplate: '连续 3 次同输入重跑均能 JSON.parse 且字段齐全，即通过。',
  },
  format_drift: {
    label: '结构漂移',
    layer: '模型能力',
    symptom: '返回看似 JSON，但字段名、类型或层级不符合 Skill schema。',
    likelyCause: 'schema 与 prompt 示例不一致，或模型按语义改写了字段。',
    publicFixHint: '让 prompt 示例与 outputSchema 完全同名同层级。',
    repairTemplate: '把 outputSchema 字段逐项写进 prompt；增加一个正确 JSON 样例。',
    verifyTemplate: '用 schema 校验器复验；字段名/类型全部通过且无额外包装层即通过。',
  },
}

function skillInfo(skill: FailureKnowledgeReport['skill']): { id: string; title: string; slug?: string } | null {
  if (!skill) return null
  if (typeof skill === 'string') return { id: skill, title: skill }
  const id = String(skill.id || '')
  if (!id) return null
  return { id, title: skill.title || skill.slug || id, slug: skill.slug }
}

type FailureAggregate = {
  profileKey: string
  errorType: string
  modelName: string
  primaryInputBucket: string
  primaryModelVersion: string | null
  count: number
  skills: Map<string, { id: string; title: string; slug?: string; count: number }>
  inputBuckets: Map<string, number>
  outputBuckets: Map<string, number>
  modelBreakdown: Record<string, number>
  modelVersions: Map<string, number>
  modelVersionBreakdown: Record<string, number>
  sourceBreakdown: Record<string, number>
}

export function aggregateFailureKnowledge(
  reports: FailureKnowledgeReport[],
  limit = 50,
): FailureKnowledgeGroup[] {
  const groups = new Map<string, FailureAggregate>()

  for (const r of reports) {
    if (r.suppressed) continue
    const errorType = (r.errorType || '').trim()
    if (!errorType) continue
    const modelName = (r.modelName || 'unknown').trim() || 'unknown'
    const modelVersion = (r.modelVersion || '').trim()
    const modelVersionKey = modelVersion || 'unversioned'
    const s = skillInfo(r.skill)
    const skillId = s?.id || 'unknown-skill'
    const primaryInputBucket = (r.inputSizeBucket || 'unknown-input').trim() || 'unknown-input'
    const key = `${skillId}|${primaryInputBucket}|${errorType}|${modelVersionKey}`
    const g: FailureAggregate =
      groups.get(key) ||
      {
        profileKey: key,
        errorType,
        modelName,
        primaryInputBucket,
        primaryModelVersion: null,
        count: 0,
        skills: new Map(),
        inputBuckets: new Map(),
        outputBuckets: new Map(),
        modelBreakdown: {},
        modelVersions: new Map(),
        modelVersionBreakdown: {},
        sourceBreakdown: {},
      }
    g.count++
    g.modelBreakdown[modelName] = (g.modelBreakdown[modelName] || 0) + 1
    if ((g.modelBreakdown[modelName] || 0) > (g.modelBreakdown[g.modelName] || 0)) g.modelName = modelName
    if (modelVersion) {
      const next = (g.modelVersions.get(modelVersion) || 0) + 1
      g.modelVersions.set(modelVersion, next)
      g.modelVersionBreakdown[modelVersion] = next
      const currentPrimaryCount = g.primaryModelVersion ? g.modelVersions.get(g.primaryModelVersion) || 0 : 0
      if (!g.primaryModelVersion || next > currentPrimaryCount) g.primaryModelVersion = modelVersion
    }
    if (s) {
      const prev = g.skills.get(s.id) || { ...s, count: 0 }
      prev.count++
      g.skills.set(s.id, prev)
    }
    if (r.inputSizeBucket) g.inputBuckets.set(r.inputSizeBucket, (g.inputBuckets.get(r.inputSizeBucket) || 0) + 1)
    if (r.outputSizeBucket) g.outputBuckets.set(r.outputSizeBucket, (g.outputBuckets.get(r.outputSizeBucket) || 0) + 1)
    const source = r.source || 'unknown'
    g.sourceBreakdown[source] = (g.sourceBreakdown[source] || 0) + 1
    groups.set(key, g)
  }

  return [...groups.values()]
    .sort((a, b) => b.count - a.count || a.errorType.localeCompare(b.errorType) || a.profileKey.localeCompare(b.profileKey))
    .slice(0, limit)
    .map((g) => ({
      profileKey: g.profileKey,
      errorType: g.errorType,
      modelName: g.modelName,
      primaryInputBucket: g.primaryInputBucket,
      primaryModelVersion: g.primaryModelVersion,
      count: g.count,
      skillCount: g.skills.size,
      sampleSkills: [...g.skills.values()].sort((a, b) => b.count - a.count).slice(0, 3),
      inputBuckets: [...g.inputBuckets.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 3),
      outputBuckets: [...g.outputBuckets.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 3),
      modelBreakdown: g.modelBreakdown,
      modelVersions: [...g.modelVersions.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 5),
      modelVersionBreakdown: g.modelVersionBreakdown,
      sourceBreakdown: g.sourceBreakdown,
      meta: FAILURE_META[g.errorType] || {
        label: g.errorType,
        layer: '基础设施',
        symptom: '系统记录到未识别的失败类型。',
        likelyCause: '错误分类器还未覆盖该模式。',
        publicFixHint: '先按 runId 查服务端日志，再补充分类。',
        repairTemplate: '扩展 errorTaxonomy，将该错误归入稳定标签。',
        verifyTemplate: '重跑同一用例，确认新标签稳定出现。',
      },
    }))
}
