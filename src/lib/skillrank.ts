// 可信分加权计算（沿用 skillRank 字段，前台展示为“可信分”）

export interface SkillMetricsInput {
  evalPassRate?: number // 评测通过率 0..1
  stability?: number // 稳定性 0..1
  costAdvantage?: number // 成本优势 0..1（越省越高）
  latencyScore?: number // 延迟表现 0..1（越快越高）
  formatSuccessRate?: number // 输出格式成功率 0..1
  maintenance?: number // 维护活跃度 0..1
  userFeedback?: number // 用户反馈 0..1
}

const clamp01 = (x?: number) => Math.max(0, Math.min(1, x ?? 0))

export function computeSkillRank(m: SkillMetricsInput): number {
  const score =
    clamp01(m.evalPassRate) * 0.35 +
    clamp01(m.stability) * 0.15 +
    clamp01(m.costAdvantage) * 0.15 +
    clamp01(m.latencyScore) * 0.1 +
    clamp01(m.formatSuccessRate) * 0.1 +
    clamp01(m.maintenance) * 0.1 +
    clamp01(m.userFeedback) * 0.05
  return Math.round(score * 1000) / 10 // → 0..100，一位小数
}

/** 由 Skill 聚合指标推导可信分（缺评测集时用稳定性近似评测通过率） */
export function skillRankFromAggregates(s: {
  successRate?: number | null
  avgCost?: number | null
  avgLatencyMs?: number | null
  formatSuccessRate?: number | null
  avgRating?: number | null
  trustedCompatibleRunCount?: number | null
  lastUpdatedAt?: string | Date | null
}): number {
  const costAdvantage = s.avgCost != null ? 1 / (1 + (s.avgCost as number) * 50) : 0.5
  const latencyScore =
    s.avgLatencyMs != null ? 1 / (1 + (s.avgLatencyMs as number) / 4000) : 0.5
  const base = computeSkillRank({
    evalPassRate: s.successRate ?? 0,
    stability: s.successRate ?? 0,
    costAdvantage,
    latencyScore,
    formatSuccessRate: s.formatSuccessRate ?? 0,
    maintenance: recencyScore(s.lastUpdatedAt),
    userFeedback: (s.avgRating ?? 0) / 5,
  })
  if (s.trustedCompatibleRunCount == null) return base
  const trustedEvidenceScore = trustedCompatibleEvidenceScore(s.trustedCompatibleRunCount)
  return Math.round((base * 0.85 + trustedEvidenceScore * 15) * 10) / 10
}

function recencyScore(d?: string | Date | null): number {
  if (!d) return 0.3
  const days = (Date.now() - new Date(d).getTime()) / 86_400_000
  if (days <= 7) return 1
  if (days <= 30) return 0.7
  if (days <= 90) return 0.4
  return 0.2
}

export function trustedCompatibleEvidenceScore(count?: number | null): number {
  const n = Math.max(0, Number(count || 0))
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(1, Math.log10(1 + n) / Math.log10(101))
}
