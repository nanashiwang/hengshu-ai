import type { RouteMode } from './constants'

export interface RoutePolicy {
  default?: string
  strategies?: Record<string, string[]>
}
export interface RecommendedModels {
  cloud?: string[]
  local?: string[]
}

/**
 * 任务级路由：依据路由策略 + 路由模式选出主模型与 fallback 列表。
 * 优先级：strategies[mode] → recommended.cloud → 全局默认模型。
 */
export function selectModel(
  routePolicy: RoutePolicy | null | undefined,
  recommended: RecommendedModels | null | undefined,
  mode: RouteMode | undefined,
  fallbackDefault: string,
): { model: string; fallbacks: string[]; mode: RouteMode } {
  const resolvedMode: RouteMode = mode || (routePolicy?.default as RouteMode) || 'balanced'
  const strategies = routePolicy?.strategies || {}
  const cloud = recommended?.cloud || []

  const primary =
    strategies[resolvedMode]?.[0] || cloud[0] || fallbackDefault

  const fallbacks = [...(strategies.fallback || []), ...cloud, fallbackDefault].filter(
    (m, i, arr) => m && m !== primary && arr.indexOf(m) === i,
  )

  return { model: primary, fallbacks, mode: resolvedMode }
}
