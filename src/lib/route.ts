import type { RouteMode } from './constants'
import { MODEL_PRICES } from './constants'

export interface RoutePolicy {
  default?: string
  strategies?: Record<string, string[]>
  // 数据回写(#15 护城河第1层)：由真实兼容回流重算，优先于作者手填 strategies；不覆盖 strategies 本身
  dataDriven?: {
    cheap?: string[]
    fast?: string[]
    quality?: string[]
    recomputedAt?: string
  }
}
export interface RecommendedModels {
  cloud?: string[]
  local?: string[]
}
export interface SelectModelOptions {
  personalized?: string[]
}

// 成本代理：每 1k token 进+出价之和（越小越省），仅用于同 Skill 内模型成本排序
export function modelCostProxy(model: string): number {
  const p = MODEL_PRICES[model] || MODEL_PRICES.default
  return (p?.in || 0) + (p?.out || 0)
}

export interface RouteRankInput {
  modelName: string
  successRate: number
  avgLatencyMs: number
  formatRate: number
  lowSample: boolean
}

export interface PersonalRouteRun {
  model?: string | null
  success?: boolean | null
  formatValid?: boolean | null
  estimatedCost?: number | null
  latencyMs?: number | null
}

// 由逐模型兼容聚合排出数据驱动路由：只取"够样本 + 成功率达标"的可用模型，再按 省/快/质 三维排序。
export function rankDataDrivenRoute(
  models: RouteRankInput[],
  minSuccess = 0.7,
): { cheap: string[]; fast: string[]; quality: string[] } {
  const working = models.filter((m) => !m.lowSample && m.successRate >= minSuccess)
  const cheap = [...working]
    .sort(
      (a, b) => modelCostProxy(a.modelName) - modelCostProxy(b.modelName) || b.successRate - a.successRate,
    )
    .map((m) => m.modelName)
  const fast = [...working].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs).map((m) => m.modelName)
  const quality = [...working]
    .sort(
      (a, b) =>
        b.successRate * 0.6 + b.formatRate * 0.4 - (a.successRate * 0.6 + a.formatRate * 0.4),
    )
    .map((m) => m.modelName)
  return { cheap, fast, quality }
}

// 私人台账路由(#15)：按当前用户在同一 Skill 的历史运行实绩，得到"个人够用且便宜"的模型顺序。
export function rankPersonalizedRoute(
  runs: PersonalRouteRun[],
  mode: RouteMode,
  minRuns = 2,
  minSuccess = 0.7,
): string[] {
  const byModel = new Map<
    string,
    { runs: number; ok: number; format: number; cost: number; costN: number; latency: number; latencyN: number }
  >()
  for (const r of runs) {
    const model = r.model?.trim()
    if (!model) continue
    const a = byModel.get(model) || { runs: 0, ok: 0, format: 0, cost: 0, costN: 0, latency: 0, latencyN: 0 }
    a.runs++
    if (r.success) {
      a.ok++
      if (r.formatValid) a.format++
      if (typeof r.estimatedCost === 'number' && Number.isFinite(r.estimatedCost)) {
        a.cost += Math.max(0, r.estimatedCost)
        a.costN++
      }
      if (typeof r.latencyMs === 'number' && Number.isFinite(r.latencyMs) && r.latencyMs > 0) {
        a.latency += r.latencyMs
        a.latencyN++
      }
    }
    byModel.set(model, a)
  }

  const rows = [...byModel.entries()]
    .map(([model, a]) => {
      const successRate = a.runs ? a.ok / a.runs : 0
      const formatRate = a.ok ? a.format / a.ok : 0
      return {
        model,
        runs: a.runs,
        successRate,
        formatRate,
        avgCost: a.costN ? a.cost / a.costN : modelCostProxy(model),
        avgLatencyMs: a.latencyN ? a.latency / a.latencyN : Number.MAX_SAFE_INTEGER,
      }
    })
    .filter((r) => r.runs >= minRuns && r.successRate >= minSuccess)

  if (rows.length === 0) return []
  const maxCost = Math.max(...rows.map((r) => r.avgCost))
  const minCost = Math.min(...rows.map((r) => r.avgCost))
  const costScore = (cost: number) => (maxCost === minCost ? 1 : 1 - (cost - minCost) / (maxCost - minCost))

  return rows
    .sort((a, b) => {
      if (mode === 'fast') return a.avgLatencyMs - b.avgLatencyMs || b.successRate - a.successRate
      if (mode === 'quality') {
        return (
          b.successRate * 0.6 + b.formatRate * 0.4 - (a.successRate * 0.6 + a.formatRate * 0.4) ||
          a.avgCost - b.avgCost
        )
      }
      if (mode === 'balanced') {
        return (
          b.successRate * 0.5 + b.formatRate * 0.25 + costScore(b.avgCost) * 0.25 -
            (a.successRate * 0.5 + a.formatRate * 0.25 + costScore(a.avgCost) * 0.25) ||
          a.avgCost - b.avgCost
        )
      }
      return a.avgCost - b.avgCost || b.successRate - a.successRate
    })
    .map((r) => r.model)
}

/**
 * 任务级路由：依据路由策略 + 路由模式选出主模型与 fallback 列表。
 * 优先级：personalized（用户私人台账）→ dataDriven[mode]（全站真实回流）→ strategies[mode] → recommended.cloud → 全局默认。
 */
export function selectModel(
  routePolicy: RoutePolicy | null | undefined,
  recommended: RecommendedModels | null | undefined,
  mode: RouteMode | undefined,
  fallbackDefault: string,
  options: SelectModelOptions = {},
): { model: string; fallbacks: string[]; mode: RouteMode; source: 'personalized' | 'dataDriven' | 'author' | 'recommended' | 'default' } {
  const resolvedMode: RouteMode = mode || (routePolicy?.default as RouteMode) || 'balanced'
  const strategies = routePolicy?.strategies || {}
  const dataDriven = (routePolicy?.dataDriven || {}) as Record<string, string[]>
  const cloud = recommended?.cloud || []
  const dd = dataDriven[resolvedMode] || []
  const personalized = options.personalized || []

  const primary = personalized[0] || dd[0] || strategies[resolvedMode]?.[0] || cloud[0] || fallbackDefault
  const source = personalized[0]
    ? 'personalized'
    : dd[0]
      ? 'dataDriven'
      : strategies[resolvedMode]?.[0]
        ? 'author'
        : cloud[0]
          ? 'recommended'
          : 'default'

  const fallbacks = [...personalized, ...dd, ...(strategies.fallback || []), ...cloud, fallbackDefault].filter(
    (m, i, arr) => m && m !== primary && arr.indexOf(m) === i,
  )

  return { model: primary, fallbacks, mode: resolvedMode, source }
}
