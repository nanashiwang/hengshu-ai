import React from 'react'

// 通用小标签
export function Tag({
  children,
  tone = 'default',
}: {
  children: React.ReactNode
  tone?: 'default' | 'official' | 'essential' | 'featured' | 'free' | 'local' | 'pro' | 'muted'
}) {
  const tones: Record<string, string> = {
    default: 'border-[var(--border)] text-[var(--muted)]',
    official: 'border-[var(--accent)] text-[var(--accent)]',
    essential: 'border-emerald-400 text-emerald-300',
    featured: 'border-[var(--accent-2)] text-[var(--accent-2)]',
    free: 'border-[var(--warn)] text-[var(--warn)]',
    local: 'border-[var(--border)] text-[var(--text)]',
    pro: 'border-[var(--danger)] text-[var(--danger)]',
    muted: 'border-[var(--border)] text-[var(--muted)]',
  }
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export function SkillStatusTags({ skill }: { skill: any }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {skill.isOfficial && <Tag tone="official">官方</Tag>}
      {skill.isEssential && <Tag tone="essential">必备</Tag>}
      {skill.isFeatured && <Tag tone="featured">精选</Tag>}
      {skill.isFreeleech && <Tag tone="free">限免</Tag>}
    </span>
  )
}
