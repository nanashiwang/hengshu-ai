import Link from 'next/link'
import { getPayloadClient } from '@/lib/payload'
import { Pagination } from '@/components/Pagination'
import { formatNumber, formatPercent } from '@/lib/format'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

export default async function RankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const qp = await searchParams
  const payload = await getPayloadClient()
  // 两个榜单各自独立分页：sp=SkillRank 榜页码，up=贡献榜页码
  const skillPage = Math.max(1, parseInt(qp.sp || '1', 10) || 1)
  const userPage = Math.max(1, parseInt(qp.up || '1', 10) || 1)
  const [skills, users] = await Promise.all([
    payload.find({
      collection: 'skills',
      where: { status: { equals: 'published' } },
      sort: '-skillRank',
      limit: PAGE_SIZE,
      page: skillPage,
      depth: 1,
    }),
    payload.find({
      collection: 'users',
      sort: '-contributionScore',
      limit: PAGE_SIZE,
      page: userPage,
      overrideAccess: true,
    }),
  ])
  const skillBase = ((skills.page || skillPage) - 1) * PAGE_SIZE
  const userBase = ((users.page || userPage) - 1) * PAGE_SIZE

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">排行榜</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* SkillRank 榜 */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
          <h2 className="mb-3 text-sm font-semibold">SkillRank 榜</h2>
          <ol className="space-y-1 text-sm">
            {skills.docs.map((s: any, i: number) => {
              const rank = skillBase + i + 1
              return (
                <li key={s.id} className="flex items-center gap-3 py-1.5">
                  <span className={`w-6 text-right ${rank <= 3 ? 'font-bold text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
                    {rank}
                  </span>
                  <Link href={`/skills/${s.slug}`} className="min-w-0 flex-1 truncate hover:text-[var(--accent)]">
                    {s.title}
                  </Link>
                  <span className="text-xs text-[var(--muted)]">成功 {formatPercent(s.successRate)}</span>
                  <span className="w-10 text-right font-semibold text-[var(--accent)]">
                    {Math.round(s.skillRank || 0)}
                  </span>
                </li>
              )
            })}
          </ol>
          <Pagination
            page={skills.page || skillPage}
            totalPages={skills.totalPages || 1}
            basePath="/rank"
            pageKey="sp"
            params={{ up: qp.up }}
          />
        </section>

        {/* 贡献榜 */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5">
          <h2 className="mb-3 text-sm font-semibold">贡献榜</h2>
          <ol className="space-y-1 text-sm">
            {users.docs.map((u: any, i: number) => {
              const rank = userBase + i + 1
              return (
                <li key={u.id} className="flex items-center gap-3 py-1.5">
                  <span className={`w-6 text-right ${rank <= 3 ? 'font-bold text-[var(--accent-2)]' : 'text-[var(--muted)]'}`}>
                    {rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{u.username}</span>
                  <span className="text-xs text-[var(--muted)]">Lv.{u.level}</span>
                  <span className="w-14 text-right font-semibold text-[var(--accent-2)]">
                    ⚡ {formatNumber(u.contributionScore)}
                  </span>
                </li>
              )
            })}
          </ol>
          <Pagination
            page={users.page || userPage}
            totalPages={users.totalPages || 1}
            basePath="/rank"
            pageKey="up"
            params={{ sp: qp.sp }}
          />
        </section>
      </div>
    </div>
  )
}
