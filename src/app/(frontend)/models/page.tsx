import { getPayloadClient } from '@/lib/payload'
import { aggregateModelsGlobal } from '@/lib/compat'
import { rankModels, type ModelRankRow } from '@/lib/modelrank'
import { formatLatency, formatPercent } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '模型中立榜 · 衡术 Hengshu',
  description: '基于真实运行数据的中立模型评测：成功率、延迟、官方报价与性价比。排名不含平台收益因素。',
}

const SORTS = [
  { key: 'value', label: '性价比' },
  { key: 'quality', label: '质量' },
  { key: 'latency', label: '速度' },
  { key: 'price', label: '价格' },
] as const

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>
}) {
  const sp = await searchParams
  const sortBy = (SORTS.find((s) => s.key === sp.sort)?.key || 'value') as
    | 'value'
    | 'quality'
    | 'latency'
    | 'price'

  const payload = await getPayloadClient()
  const [stats, priceRes] = await Promise.all([
    aggregateModelsGlobal(payload),
    payload.find({ collection: 'model-price-snapshots', limit: 500, depth: 0, overrideAccess: true }),
  ])
  // 官方价：同模型取最近一条快照
  const priceByModel = new Map<string, any>()
  for (const p of priceRes.docs as any[]) {
    const prev = priceByModel.get(p.model)
    if (!prev || new Date(p.capturedAt || p.updatedAt || 0) > new Date(prev.capturedAt || prev.updatedAt || 0)) {
      priceByModel.set(p.model, p)
    }
  }
  const rows: ModelRankRow[] = stats.map((s) => {
    const price = priceByModel.get(s.model)
    return {
      model: s.model,
      successRate: s.successRate,
      formatRate: s.formatRate,
      avgLatencyMs: s.avgLatencyMs,
      samples: s.samples,
      officialInputPrice: price?.inputPrice,
      officialOutputPrice: price?.outputPrice,
    }
  })
  const ranked = rankModels(rows, sortBy)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">模型中立榜</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          基于全站真实运行的实测事实（成功率/延迟）+ 官方公开报价。
          <b className="text-[var(--text)]">排名不含任何平台收益因素</b>
          （CI 断言强制 · 时间衰减 30 天，近期数据主导）。
        </p>
      </div>

      <div className="flex gap-1 text-sm">
        {SORTS.map((s) => (
          <a
            key={s.key}
            href={`/models?sort=${s.key}`}
            className={`rounded-md px-3 py-1 ${
              sortBy === s.key
                ? 'bg-[var(--panel-2)] text-[var(--text)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {s.label}
          </a>
        ))}
      </div>

      {ranked.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-[var(--muted)]">
          还没有足够的运行数据。跑一些 Skill 后这里会出现模型实测榜。
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--panel)] text-left text-xs text-[var(--muted)]">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">模型</th>
                <th className="px-3 py-2 text-right font-medium">质量</th>
                <th className="px-3 py-2 text-right font-medium">成功率</th>
                <th className="px-3 py-2 text-right font-medium">延迟</th>
                <th className="px-3 py-2 text-right font-medium">官方价/1k</th>
                <th className="px-3 py-2 text-right font-medium">性价比</th>
                <th className="px-3 py-2 text-right font-medium">样本</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((m, i) => (
                <tr key={m.model} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-3 py-2.5 text-[var(--muted)]">{m.lowSample ? '—' : i + 1}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{m.model}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[var(--accent)]">
                    {m.lowSample ? '积累中' : m.qualityScore}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {m.lowSample ? `已${m.samples}次` : formatPercent(m.successRate)}
                  </td>
                  <td className="px-3 py-2.5 text-right">{formatLatency(m.avgLatencyMs)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {m.officialPrice != null ? `¥${m.officialPrice}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[var(--accent-2)]">
                    {m.valueScore != null && !m.lowSample ? m.valueScore : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[var(--muted)]">{m.samples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-[var(--faint)]">
        方法论：逐条报告按时间指数衰减（半衰期 30 天）× 来源权重（verified/benchmark=1 · 社区=0.5 · 在线=0.3）加权。
        质量 = 0.7×成功率 + 0.3×格式率。性价比 = 质量 ÷ 官方价。样本 &lt; 5 标"积累中"、不参与排名。
      </p>
    </div>
  )
}
