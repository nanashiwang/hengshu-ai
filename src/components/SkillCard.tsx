import Link from 'next/link'
import { SkillStatusTags } from './Tag'
import { formatCost, formatLatency, formatNumber, formatPercent } from '@/lib/format'

// SkillRank 颜色
function rankColor(rank?: number | null) {
  const r = rank || 0
  if (r >= 85) return 'var(--accent-2)'
  if (r >= 70) return 'var(--accent)'
  if (r >= 50) return 'var(--warn)'
  return 'var(--muted)'
}

export function SkillCard({ skill }: { skill: any }) {
  const cat = typeof skill.category === 'object' ? skill.category : null
  const author = typeof skill.author === 'object' ? skill.author : null
  return (
    <Link
      href={`/skills/${skill.slug}`}
      className="group flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 transition-colors hover:border-[var(--accent)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium group-hover:text-[var(--accent)]">{skill.title}</h3>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{skill.description}</p>
        </div>
        <div
          className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border"
          style={{ borderColor: rankColor(skill.skillRank), color: rankColor(skill.skillRank) }}
          title="SkillRank"
        >
          <span className="text-sm font-bold leading-none">{Math.round(skill.skillRank || 0)}</span>
          <span className="text-[9px] text-[var(--muted)]">RANK</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
        {cat && <span>{cat.icon} {cat.name}</span>}
        {author && <span>· {author.username}</span>}
        <SkillStatusTags skill={skill} />
      </div>

      <div className="grid grid-cols-4 gap-2 border-t border-[var(--border)] pt-3 text-center text-[11px]">
        <Metric label="成功率" value={formatPercent(skill.successRate)} />
        <Metric label="成本" value={formatCost(skill.avgCost)} />
        <Metric label="耗时" value={formatLatency(skill.avgLatencyMs)} />
        <Metric label="调用" value={formatNumber(skill.runCount)} />
      </div>
    </Link>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-medium text-[var(--text)]">{value}</div>
      <div className="text-[var(--muted)]">{label}</div>
    </div>
  )
}
