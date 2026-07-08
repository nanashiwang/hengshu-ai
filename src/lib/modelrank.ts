// 中立模型榜排名（四面墙·数学隔离）。
// ⚠️ 本文件受 6j-1 CI 断言保护：入参与实现禁止出现 margin/isOurs/revenue/profit 等平台收益字段。
// 排名只依据"用户可验证的中立事实"：实测成功率/格式率/延迟 + 官方公开报价。平台是否自营、赚多少，与排名无关。

export interface ModelRankRow {
  model: string
  successRate: number // 0-1，跨全站 Skill 的加权实测成功率
  formatRate: number // 0-1
  avgLatencyMs: number
  samples: number // 报告样本数（低样本不参与排名主榜）
  effectiveSamples?: number // 衰减×来源权重后的有效样本量，只用于解释，不参与收益排序
  sourceSummary?: Array<{ source: string; count: number; weight: number }>
  inputBucketSummary?: Array<{ inputBucket: string; count: number; effectiveSamples: number; successRate: number; formatRate: number }>
  officialInputPrice?: number // 元/1k token（官方报价快照，缺失则不计入性价比）
  officialOutputPrice?: number
}

export interface RankedModel extends ModelRankRow {
  officialPrice: number | null // in+out 官方价之和（元/1k），缺失为 null
  qualityScore: number // 0-100，成功率×格式率的综合质量
  valueScore: number | null // 质量/官方价 的性价比（越高越划算），无官方价为 null
  lowSample: boolean
}

const MIN_SAMPLE = 5

// 质量分：成功率主导 + 格式率，0-100
export function qualityScore(row: Pick<ModelRankRow, 'successRate' | 'formatRate'>): number {
  return Math.round((0.7 * (row.successRate || 0) + 0.3 * (row.formatRate || 0)) * 100)
}

// 由中立事实排出模型榜。sortBy 决定主排序键；默认按性价比(有官方价者优先)，无价则退化按质量。
export function rankModels(
  rows: ModelRankRow[],
  sortBy: 'value' | 'quality' | 'latency' | 'price' = 'value',
): RankedModel[] {
  const ranked: RankedModel[] = rows.map((r) => {
    const officialPrice =
      typeof r.officialInputPrice === 'number' && typeof r.officialOutputPrice === 'number'
        ? Math.round((r.officialInputPrice + r.officialOutputPrice) * 10000) / 10000
        : null
    const q = qualityScore(r)
    const valueScore = officialPrice && officialPrice > 0 ? Math.round((q / officialPrice) * 100) / 100 : null
    return { ...r, officialPrice, qualityScore: q, valueScore, lowSample: r.samples < MIN_SAMPLE }
  })

  const cmp: Record<typeof sortBy, (a: RankedModel, b: RankedModel) => number> = {
    value: (a, b) => (b.valueScore ?? -1) - (a.valueScore ?? -1) || b.qualityScore - a.qualityScore,
    quality: (a, b) => b.qualityScore - a.qualityScore || (a.avgLatencyMs || 0) - (b.avgLatencyMs || 0),
    latency: (a, b) => (a.avgLatencyMs || Infinity) - (b.avgLatencyMs || Infinity),
    price: (a, b) => (a.officialPrice ?? Infinity) - (b.officialPrice ?? Infinity),
  }
  // 低样本一律沉底，避免噪声霸榜
  return ranked.sort((a, b) => {
    if (a.lowSample !== b.lowSample) return a.lowSample ? 1 : -1
    return cmp[sortBy](a, b)
  })
}
