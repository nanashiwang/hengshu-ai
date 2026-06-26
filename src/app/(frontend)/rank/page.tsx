import Link from 'next/link'
import { getPayloadClient } from '@/lib/payload'
import { formatNumber, formatPercent } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function RankPage() {
  const payload = await getPayloadClient()
  const [skills, users] = await Promise.all([
    payload.find({
      collection: 'skills',
      where: { status: { equals: 'published' } },
      sort: '-skillRank',
      limit: 20,
      depth: 1,
    }),
    payload.find({ collection: 'users', sort: '-contributionScore', limit: 20, overrideAccess: true }),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">排行榜</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* SkillRank 榜 */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
          <h2 className="mb-3 text-sm font-semibold">SkillRank 榜</h2>
          <ol className="space-y-1 text-sm">
            {skills.docs.map((s: any, i: number) => (
              <li key={s.id} className="flex items-center gap-3 py-1.5">
                <span className={`w-5 text-right ${i < 3 ? 'font-bold text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
                  {i + 1}
                </span>
                <Link href={`/skills/${s.slug}`} className="min-w-0 flex-1 truncate hover:text-[var(--accent)]">
                  {s.title}
                </Link>
                <span className="text-xs text-[var(--muted)]">成功 {formatPercent(s.successRate)}</span>
                <span className="w-10 text-right font-semibold text-[var(--accent)]">
                  {Math.round(s.skillRank || 0)}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* 贡献榜 */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
          <h2 className="mb-3 text-sm font-semibold">贡献榜</h2>
          <ol className="space-y-1 text-sm">
            {users.docs.map((u: any, i: number) => (
              <li key={u.id} className="flex items-center gap-3 py-1.5">
                <span className={`w-5 text-right ${i < 3 ? 'font-bold text-[var(--accent-2)]' : 'text-[var(--muted)]'}`}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{u.username}</span>
                <span className="text-xs text-[var(--muted)]">Lv.{u.level}</span>
                <span className="w-14 text-right font-semibold text-[var(--accent-2)]">
                  ⚡ {formatNumber(u.contributionScore)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}
